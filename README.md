# ShadowChat Frontend

React & Vite client frontend for ShadowChat.

## Deployment to Cloudflare Pages

1. Log in to Cloudflare and navigate to **Workers & Pages** -> **Pages** -> **Connect to Git**.
2. Select the `shadowchat-frontend` repository.
3. Configure **Build settings**:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Under **Environment variables (advanced)**, add:
   - `VITE_API_URL`: Your Hugging Face Space URL (e.g. `https://<username>-shadowchat-backend.hf.space`).
5. Save and Deploy.
