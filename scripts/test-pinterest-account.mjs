#!/usr/bin/env node
// Test script to verify Pinterest account info
import process from "node:process";

const PINTEREST_ACCESS_TOKEN = process.env.PINTEREST_ACCESS_TOKEN || "";

if (!PINTEREST_ACCESS_TOKEN) {
  console.error("❌ Missing PINTEREST_ACCESS_TOKEN");
  process.exit(2);
}

async function testPinterestAccount() {
  try {
    // Get user info
    console.log("🔍 Fetching Pinterest account info...\n");

    const userResponse = await fetch("https://api.pinterest.com/v5/user_account", {
      headers: {
        Authorization: `Bearer ${PINTEREST_ACCESS_TOKEN}`,
        "User-Agent": "lexyhub/1.0",
      },
    });

    if (!userResponse.ok) {
      const text = await userResponse.text();
      console.error(`❌ API Error: ${userResponse.status}`);
      console.error(text);
      process.exit(1);
    }

    const userData = await userResponse.json();
    console.log("✅ Account authenticated successfully!");
    console.log(`   Username: ${userData.username || "N/A"}`);
    console.log(`   Account Type: ${userData.account_type || "N/A"}`);
    console.log(`   Profile URL: https://pinterest.com/${userData.username || ""}`);
    console.log();

    // Get boards
    console.log("🔍 Fetching boards...\n");

    const boardsResponse = await fetch("https://api.pinterest.com/v5/boards?page_size=25", {
      headers: {
        Authorization: `Bearer ${PINTEREST_ACCESS_TOKEN}`,
        "User-Agent": "lexyhub/1.0",
      },
    });

    if (!boardsResponse.ok) {
      const text = await boardsResponse.text();
      console.error(`❌ Boards API Error: ${boardsResponse.status}`);
      console.error(text);
      process.exit(1);
    }

    const boardsData = await boardsResponse.json();
    const boards = boardsData.items || [];

    if (boards.length === 0) {
      console.log("⚠️  No boards found on this account");
      console.log();
      console.log("📝 Next Steps:");
      console.log("   1. Go to https://pinterest.com");
      console.log("   2. Create some boards (e.g., 'Handmade Gifts', 'Trending Products')");
      console.log("   3. Add at least 10-20 pins to each board");
      console.log("   4. Re-run this test");
      console.log();
    } else {
      console.log(`✅ Found ${boards.length} board(s):\n`);

      for (const board of boards) {
        console.log(`   📌 ${board.name}`);
        console.log(`      ID: ${board.id}`);
        console.log(`      Pin Count: ${board.pin_count || 0}`);
        console.log(`      URL: https://pinterest.com${board.owner?.username ? `/${board.owner.username}` : ""}/${board.id}`);
        console.log();
      }

      if (boards.some(b => (b.pin_count || 0) > 0)) {
        console.log("✅ Your account is ready for keyword collection!");
      } else {
        console.log("⚠️  Boards exist but have no pins. Add some pins to start collecting keywords.");
      }
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

testPinterestAccount();
