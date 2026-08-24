import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({
  projectId: "ai-studio-midnightsanctuar-e4903ea2-ab50-4a6a-aac3-88d6a6d849a4"
});
const db = getFirestore();

(async () => {
  try {
    const users = await db.collection('users').get();
    console.log("Total users:", users.size);
    users.forEach(doc => {
      const data = doc.data();
      console.log(`User ID: ${doc.id}`);
      console.log(`- Conversations count: ${data.conversations ? data.conversations.length : 0}`);
      if (data.conversations && data.conversations.length > 0) {
         console.log(`- Sample modelId: ${data.conversations[0].modelId}`);
      }
      console.log(`- Settings model: ${data.settings ? data.settings.model : 'none'}`);
    });
  } catch (e) {
    console.error(e);
  }
})();
