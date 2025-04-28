export async function queryVectorize(
  ai: Ai,
  vectorizeIndex: VectorizeIndex,
  query: string,
  topK: number
) {
  // Recommendation from: https://huggingface.co/BAAI/bge-base-en-v1.5#model-list
  const [queryEmbedding] = await getEmbeddings(ai, [
    "Represent this sentence for searching relevant passages: " + query,
  ]);

  const { matches } = await vectorizeIndex.query(queryEmbedding, {
    topK,
    returnMetadata: "all",
    returnValues: false,
  });

  return matches.map((match, i) => ({
    similarity: Math.min(match.score, 1),
    id: match.id,
    url: sourceToUrl(String(match.metadata?.filePath ?? "")),
    text: String(match.metadata?.text ?? ""),
  }));
}

const TOP_DIR = "src/content/docs";
function sourceToUrl(path: string) {
  const prefix = `${TOP_DIR}/`;
  return (
    "https://developers.cloudflare.com/" +
    (path.startsWith(prefix) ? path.slice(prefix.length) : path)
      .replace(/index\.mdx$/, "")
      .replace(/\.mdx$/, "")
  );
}

async function getEmbeddings(ai: Ai, strings: string[]) {
  const response = await doWithRetries(() =>
    ai.run("@cf/baai/bge-base-en-v1.5", {
      text: strings,
      // @ts-expect-error pooling not in types yet
      pooling: "cls",
    })
  );

  return response.data;
}

/**
 * @template T
 * @param {() => Promise<T>} action
 */
async function doWithRetries<T>(action: () => Promise<T>) {
  const NUM_RETRIES = 10;
  const INIT_RETRY_MS = 50;
  for (let i = 0; i <= NUM_RETRIES; i++) {
    try {
      return await action();
    } catch (e) {
      // TODO: distinguish between user errors (4xx) and system errors (5xx)
      console.error(e);
      if (i === NUM_RETRIES) {
        throw e;
      }
      // Exponential backoff with full jitter
      await scheduler.wait(Math.random() * INIT_RETRY_MS * Math.pow(2, i));
    }
  }
  // Should never reach here – last loop iteration should return
  throw new Error("An unknown error occurred");
}
