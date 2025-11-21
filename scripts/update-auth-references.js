const fs = require("fs");
const path = require("path");

// Files that need auth updates
const filesToUpdate = [
  "components/main-nav.tsx",
  "components/chat-example.tsx",
  "components/chat-room-list.tsx",
  "components/notification-badge.tsx",
  "components/notification-center.tsx",
  "components/notification-dropdown.tsx",
  "components/notification-history.tsx",
  "components/notification-preferences.tsx",
  "components/optimized-chat-room.tsx",
  "components/video-call/VideoCallInterface.tsx",
  "components/chat-interface.tsx",
  "components/ChatInterface.tsx",
];

// Replacement patterns
const replacements = [
  {
    from: /import { useSession } from "next-auth\/react";/g,
    to: 'import { useUnifiedAuth } from "@/lib/unified-auth-context";',
  },
  {
    from: /import { signOut, useSession } from "next-auth\/react";/g,
    to: 'import { useUnifiedAuth } from "@/lib/unified-auth-context";',
  },
  {
    from: /const { data: session } = useSession\(\);/g,
    to: "const { user } = useUnifiedAuth();",
  },
  {
    from: /const { data: session, status } = useSession\(\);/g,
    to: "const { user, loading } = useUnifiedAuth();",
  },
  {
    from: /session\?\.user/g,
    to: "user",
  },
  {
    from: /session\.user/g,
    to: "user",
  },
  {
    from: /status === "loading"/g,
    to: "loading",
  },
];

function updateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, "utf8");
    let updated = false;

    replacements.forEach(({ from, to }) => {
      if (from.test(content)) {
        content = content.replace(from, to);
        updated = true;
      }
    });

    if (updated) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Updated: ${filePath}`);
    } else {
      console.log(`⏭️  No changes needed: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
  }
}

// Update all files
console.log("🔄 Updating authentication references...\n");

filesToUpdate.forEach((file) => {
  if (fs.existsSync(file)) {
    updateFile(file);
  } else {
    console.log(`⚠️  File not found: ${file}`);
  }
});

console.log("\n✨ Authentication reference updates completed!");
