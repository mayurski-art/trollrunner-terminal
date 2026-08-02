import { TwitterApi } from "twitter-api-v2";

export async function postToX(text: string): Promise<{ id: string; url: string }> {
  const appKey = process.env.X_API_KEY;
  const appSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_SECRET;

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    throw new Error(
      "Missing X API credentials (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET)"
    );
  }

  const client = new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
  const { data } = await client.v2.tweet(text);

  return {
    id: data.id,
    url: `https://x.com/i/web/status/${data.id}`,
  };
}
