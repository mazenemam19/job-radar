// src/scripts/test-wuzzuf-deep.ts
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function testWuzzufDeep() {
  const searchUrl = "https://wuzzuf.net/api/search/job";
  const searchPayload = {
    startIndex: 0,
    pageSize: 20,
    longitude: "31.2357",
    latitude: "30.0444",
    query: "react",
    searchFilters: {
      post_date: ["within_1_week"],
    },
  };

  console.log("🚀 Fetching Wuzzuf search results...");
  const sRes = await fetch(searchUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify(searchPayload),
  });

  if (!sRes.ok) {
    console.error("❌ Search failed");
    return;
  }

  const sData = (await sRes.json()) as any;
  const targetId = "4f998197-f766-40bc-b9b5-50eca02c11c4";
  const ids = (sData?.data || []).map((j: any) => j.id);
  
  console.log(`📡 Fetching details for IDs: ${ids.join(", ")}`);
  const detailUrl = `https://wuzzuf.net/api/job?filter[other][ids]=${ids.join(",")}`;
  const dRes = await fetch(detailUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  
  if (!dRes.ok) {
    console.error("❌ Detail fetch failed");
    return;
  }

  const dData = (await dRes.json()) as any;
  const targetJob = dData.data.find((j: any) => j.id === targetId);

  if (targetJob) {
      console.log("\n--- TARGET RAW JOB ATTRIBUTES ---");
      console.log(JSON.stringify(targetJob.attributes, null, 2));
  } else {
      console.log(`⚠️ Job ${targetId} not found in current search results.`);
      if (dData.data[0]) {
          console.log("\n--- FIRST JOB ATTRIBUTES (for debug) ---");
          console.log(JSON.stringify(dData.data[0].attributes, null, 2));
      }
  }
}

testWuzzufDeep();
