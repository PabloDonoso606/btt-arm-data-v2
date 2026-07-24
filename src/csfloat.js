import axios from "axios";
import { supabase } from "./lib/supabase.js";

async function main() {
  console.log("Updating prices from CSFloat");

  try {
    // Obtener skins de Supabase
    const { data: csfloat_hash, error } = await supabase
      .from("csfloat")
      .select("id, market_hash_name");

    if (error) throw error;

    // Obtener price-list de CSFloat
    const { data: priceList } = await axios.get(
      "https://csfloat.com/api/v1/listings/price-list",
      {
        headers: {
          Authorization: process.env.CSFLOAT_API_KEY,
        },
      },
    );

    // Crear índice por market_hash_name
    const priceMap = new Map(
      priceList.map((item) => [item.market_hash_name, item]),
    );

    // Recorrer las skins de Supabase
    for (const skin of csfloat_hash) {
      const csfloatSkin = priceMap.get(skin.market_hash_name);

      if (!csfloatSkin) {
        console.log(
          `❌ ${skin.id} | ${skin.market_hash_name} -> No encontrada`,
        );
        continue;
      }

      const price = csfloatSkin.min_price / 100;

      const { error: updateError } = await supabase
        .from("csfloat")
        .update({ price, price_updated_at: new Date().toISOString() })
        .eq("id", skin.id);

      if (updateError) {
        console.error(`${skin.id}:`, updateError.message);
        continue;
      }

      console.log(`✅ ${skin.id} | ${skin.market_hash_name} -> ${price}`);
    }
  } catch (error) {
    console.error(error);
  }

  console.log("Finished");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
