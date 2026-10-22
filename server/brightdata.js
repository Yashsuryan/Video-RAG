const brightDataTriggerUrl = "https://api.brightdata.com/datasets/v3/trigger";

export const triggerYoutubeVideoScrape = async (url) => {
  if (!process.env.PUBLIC_URL) {
    throw new Error("PUBLIC_URL is not set");
  }

  const params = new URLSearchParams({
    dataset_id: "gd_lk56epmy2i5g7lzu0k",
    endpoint: `${process.env.PUBLIC_URL}/webhook`,
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
  console.log("Bright Data response:", result);

  if (!response.ok || result.error || !result.snapshot_id) {
    throw new Error(
      result.error ?? `Bright Data request failed (${response.status})`,
    );
  }

  return result.snapshot_id;
};