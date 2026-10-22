const brightDataTriggerUrl = "https://api.brightdata.com/datasets/v3/trigger";

// Must be a public URL, e.g. https://abc123.ngrok-free.app
const webhookBaseUrl = process.env.PUBLIC_URL;

export const triggerYoutubeVideoScrape = async (url) => {
  if (!webhookBaseUrl) {
    throw new Error(
      "PUBLIC_URL is not set. Bright Data can't reach localhost, so start a tunnel (ngrok/cloudflared) and set PUBLIC_URL in .env.",
    );
  }

  const params = new URLSearchParams({
    dataset_id: "gd_lk56epmy2i5g7lzu0k",
    endpoint: `${webhookBaseUrl}/webhook`,
    notify: "false",
    format: "json",
    uncompressed_webhook: "true",
    force_deliver: "false",
    include_errors: "true",
  });

  const response = await fetch(`${brightDataTriggerUrl}?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: [{ url, country: "", transcription_language: "" }],
      limit_per_input: null,
    }),
  });

  const result = await response.json().catch(() => ({}));
  console.log(result);

  if (!response.ok || result.error || !result.snapshot_id) {
    throw new Error(
      result.error ?? `Bright Data request failed (${response.status})`,
    );
  }

  return result.snapshot_id;
};