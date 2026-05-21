<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e5e9f19e-5e75-45d1-a88f-2fe1074905d2

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

If chapter generation fails with `The specified bucket does not exist`, create or verify the Firebase Storage bucket for this project in Firebase Console under Databases & Storage > Storage. The server writes generated chapter JSON to the bucket named in `firebase-applet-config.json`, and that bucket must already exist.
