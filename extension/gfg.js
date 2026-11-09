// GeeksforGeeks articles for common techniques, so learning notes can link to a full explanation instead of
// paying Claude to write one. Every link was opened and its title checked on 2026-11-07.
// Matching is by the words in Claude's technique name; anything not listed falls back to GfG's own search.

const GFG = "https://www.geeksforgeeks.org";

// [words that identify the technique (any one matches), article path]. More specific entries first.
const ARTICLES = [
  [["binary search on answer", "binary search on the answer"], "/dsa/binary-search-on-answer-tutorial-with-problems/"],
  [["binary search"], "/dsa/binary-search/"],
  [["prefix sum", "prefix-sum", "cumulative sum", "running sum"], "/dsa/prefix-sum-array-implementation-applications-competitive-programming/"],
  [["difference array"], "/dsa/difference-array-range-update-query-o1/"],
  [["sliding window"], "/dsa/window-sliding-technique/"],
  [["fast and slow", "slow and fast", "floyd's cycle", "floyds cycle", "tortoise", "cycle detection"], "/dsa/floyds-cycle-finding-algorithm/"],
  [["two pointer", "two-pointer"], "/dsa/two-pointers-technique/"],
  [["monotonic stack", "monotone stack"], "/dsa/introduction-to-monotonic-stack-2/"],
  [["monotonic queue", "monotonic deque", "monotone queue"], "/dsa/introduction-to-monotonic-queues/"],
  [["kadane"], "/dsa/largest-sum-contiguous-subarray/"],
  [["boyer-moore", "boyer moore", "majority vote"], "/theory-of-computation/boyer-moore-majority-voting-algorithm/"],
  [["union-find", "union find", "disjoint set", "dsu"], "/dsa/introduction-to-disjoint-set-data-structure-or-union-find-algorithm/"],
  [["topological", "kahn"], "/dsa/topological-sorting/"],
  [["dijkstra"], "/dsa/dijkstras-shortest-path-algorithm-greedy-algo-7/"],
  [["bellman"], "/dsa/bellman-ford-algorithm-dp-23/"],
  [["floyd-warshall", "floyd warshall"], "/dsa/floyd-warshall-algorithm-dp-16/"],
  [["kruskal"], "/dsa/kruskals-minimum-spanning-tree-algorithm-greedy-algo-2/"],
  [["prim's", "prims", "prim "], "/dsa/prims-minimum-spanning-tree-mst-greedy-algo-5/"],
  [["breadth-first", "breadth first", "bfs"], "/dsa/breadth-first-search-or-bfs-for-a-graph/"],
  [["depth-first", "depth first", "dfs"], "/dsa/depth-first-search-or-dfs-for-a-graph/"],
  [["backtracking"], "/dsa/introduction-to-backtracking-2/"],
  [["memoization", "memoisation"], "/dsa/what-is-memoization-a-complete-tutorial/"],
  [["dynamic programming", " dp", "dp "], "/dsa/introduction-to-dynamic-programming-data-structures-and-algorithm-tutorials/"],
  [["trie", "prefix tree"], "/dsa/trie-insert-and-search/"],
  [["segment tree"], "/dsa/segment-tree-data-structure/"],
  [["fenwick", "binary indexed tree"], "/dsa/binary-indexed-tree-or-fenwick-tree-2/"],
  [["heap", "priority queue"], "/dsa/heap-data-structure/"],
  [["greedy"], "/dsa/introduction-to-greedy-algorithm-data-structures-and-algorithm-tutorials/"],
  [["bit manipulation", "bitwise", "xor"], "/dsa/bits-manipulation-important-tactics/"],
  [["dutch national flag", "three-way partition", "3-way partition"], "/dsa/sort-an-array-of-0s-1s-and-2s/"],
  [["kmp", "knuth"], "/dsa/kmp-algorithm-for-pattern-searching/"],
  [["rabin-karp", "rabin karp", "rolling hash"], "/dsa/rabin-karp-algorithm-for-pattern-searching/"],
  [["manacher"], "/dsa/manachers-algorithm-linear-time-longest-palindromic-substring-part-1/"],
  [["quickselect", "quick select"], "/dsa/quickselect-algorithm/"],
  [["counting sort"], "/dsa/counting-sort/"],
  [["bucket sort"], "/dsa/bucket-sort-2/"],
  [["merge sort"], "/dsa/merge-sort/"],
  [["divide and conquer"], "/dsa/introduction-to-divide-and-conquer-algorithm/"],
  [["sieve"], "/dsa/sieve-of-eratosthenes/"],
  [["morris"], "/dsa/inorder-tree-traversal-without-recursion-and-without-stack/"],
  [["lru"], "/system-design/lru-cache-implementation/"],
  [["hash map", "hashmap", "hash set", "hashset", "hash table", "hashing"], "/dsa/hashing-data-structure/"],
];

/** The GeeksforGeeks link for a technique name: a known article, or GfG's search for that name. */
export function gfgLink(technique) {
  const name = ` ${technique.toLowerCase()} `;
  const hit = ARTICLES.find(([words]) => words.some((w) => name.includes(w)));
  return hit ? GFG + hit[1] : `${GFG}/search/?gq=${encodeURIComponent(technique)}`;
}
