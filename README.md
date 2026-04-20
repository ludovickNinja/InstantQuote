# InstantQuote

A static GitHub Pages site that lets customers upload reference jewelry photos, describe modifications, and instantly receive 3 AI-rendered angles of their custom piece plus a price estimate.

## How It Works

1. Customer uploads 1–3 reference photos and fills in the form
2. The page POSTs to your n8n webhook
3. n8n analyzes the images with GPT-4o Vision, generates 3 renders with DALL-E 3, and calculates a price
4. The page displays the 3 renders (front, side, 45° angle) and price range

## Setup

### 1. Import the n8n Workflow

1. Open your n8n instance
2. Go to **Workflows → Import from file**
3. Select `n8n-workflow.json`
4. Add an **HTTP Header Auth** credential named `openAiApiKey` with your OpenAI API key as `Authorization: Bearer sk-...`
5. **Activate** the workflow
6. Copy the **Production Webhook URL** (shown in the Webhook node) — it will look like `https://your-n8n.com/webhook/instant-quote`

### 2. Set the Webhook URL

Open `app.js` and replace the placeholder on line 7:

```js
WEBHOOK_URL: 'YOUR_N8N_WEBHOOK_URL_HERE',
```

with your actual n8n production webhook URL.

### 3. Deploy

Merge the branch to `main`. GitHub Pages will auto-deploy and serve the site from the repository root.

Your live URL will be: `https://<your-username>.github.io/InstantQuote/`

## Price Formula

| Piece | Base Price |
|-------|-----------|
| Ring | $800 |
| Necklace | $1,200 |
| Bracelet | $1,000 |
| Earring | $600 |
| Pendant | $700 |

Material multipliers: Silver ×1.0 · Gold ×1.5 · Platinum ×2.0

Final range is ±20% of the midpoint, rounded to the nearest $50.

## File Overview

| File | Purpose |
|------|---------|
| `index.html` | Page structure and all five UI states |
| `style.css` | Clean minimal styling with goldenrod accent |
| `app.js` | Upload, form validation, webhook POST, result rendering |
| `n8n-workflow.json` | Importable n8n workflow (GPT-4o Vision + DALL-E 3) |

## Notes

- The n8n `Respond to Webhook` node sends `Access-Control-Allow-Origin: *` — this is required for the browser `fetch()` to work from the GitHub Pages domain
- DALL-E 3 images are returned as base64 (`response_format: b64_json`) so no external storage is needed
- The three DALL-E renders run in parallel after the GPT-4o Vision analysis completes, reducing total latency
