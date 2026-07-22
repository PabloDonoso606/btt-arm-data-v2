import axios from "axios";
import { supabase } from "./lib/supabase.js";

const collectionId = Number(process.env.COLLECTION_ID);

if (!collectionId) {
  throw new Error("COLLECTION_ID is required");
}

function parsePrice(price) {
  return Number(price.replace("$", "").replace(/,/g, ""));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`Updating Collection ${collectionId}`);

  const { data, error } = await supabase.rpc(
    "get_steam_apis_by_collection_id",
    { p_collection_id: collectionId },
  );

  if (error) throw error;

  console.log(`Found ${data.length} Steam APIs`);

  let requestCount = 0;

  for (const steamItem of data) {
    try {
      await sleep(1000 * 3);
      const response = await axios.get(steamItem.api_url, {
        headers: {
          "User-Agent": "SteamPriceUpdater/1.0",
        },
      });
      if (!response.data.success) {
        console.warn(
          `${steamItem.steam_id}: Steam API returned success: false`,
        );
        continue;
      }
      const priceString =
        response.data.lowest_price ?? response.data.median_price;

      if (!priceString) {
        requestCount++;
        console.warn(
          `❌ Request N°${requestCount} | Steam ID: ${steamItem.steam_id}`,
        );
        continue;
      }

      const price = parsePrice(priceString);

      const { error: updateError } = await supabase
        .from("steam")
        .update({ price, price_updated_at: new Date().toISOString() })
        .eq("id", steamItem.steam_id);

      if (updateError) {
        console.error(`${steamItem.steam_id}:`, updateError.message);
        continue;
      }

      requestCount++;

      console.log(
        `✅ Request N°${requestCount} | Steam ID: ${steamItem.steam_id} | Price: ${price}`,
      );
    } catch (error) {
      console.error(`${steamItem.steam_id}:`, error);
    }
  }

  console.log("Finished");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
