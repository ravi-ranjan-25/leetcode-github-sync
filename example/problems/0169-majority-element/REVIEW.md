# Review: 169. Majority Element

*Claude Sonnet 5.5, reviewing this [Java solution](solution.java) the way a Google SDE-2 interviewer would.*

**Verdict:** Lean No Hire

| Area | Score (1-5) | Note |
|---|---|---|
| Correctness | 4 | Correct given the guarantee that a majority element exists. Works for n=1 and all-equal arrays. |
| Time & space | 2 | O(n + k log k) time and O(k) space, where k is the number of distinct values. The sort is unnecessary, and the problem's follow-up asks for O(n) time and O(1) space. |
| Code quality | 2 | Raw `new ArrayList(...)` causes an unchecked warning, the comparator is badly indented, and the sort is a roundabout way to find a max. |
| Edge cases | 3 | Nothing breaks, but there is no reasoning about it. Correctness relies entirely on the problem's guarantee. |

## What works
- The frequency map is built correctly, and `getOrDefault` is the idiomatic way to do it.
- The result is correct. Sorting entries by count descending puts the most frequent value first, and that value is the majority element.
- The comparator never subtracts counts, so there is no overflow risk, though that is unneeded here since `Integer.compare` is simpler.

## What to change
1. **Drop the sort.** Sorting k entries costs O(k log k) just to find a maximum. Track the best count while iterating, or return as soon as a count exceeds `n/2`. That makes the work O(n) with one pass and no list.
   ```java
   if (count > nums.length / 2) return key;
   ```
2. **Answer the follow-up.** The problem explicitly asks for O(1) space. A candidate at L4 should reach Boyer-Moore voting without a prompt, or at least name it. The hash map plus list uses O(n) space in the worst case.
3. **Clean up the code.**
   - Use `new ArrayList<>(map.entrySet())` to avoid the raw type.
   - Use `Integer.compare(b.getValue(), a.getValue())`, or `Map.Entry.comparingByValue(Comparator.reverseOrder())`, instead of the hand-written three-way branch.
   - Use a for-each loop: `for (int x : nums) map.merge(x, 1, Integer::sum);`.
   - Fix the indentation and remove the redundant `key` variable. You compute `key` and then still write `nums[i]` in `put`.
4. **Use the problem's guarantee.** Because the majority element has more than n/2 occurrences, other simpler options exist, such as sorting the array and returning `nums[n/2]`. Say which trade-off you chose and why.

## Better approach
Boyer-Moore voting runs in O(n) time and O(1) space. Pair off each majority occurrence with a different element. Because the majority element appears more than half the time, it survives.

```java
public int majorityElement(int[] nums) {
    int candidate = 0, count = 0;
    for (int x : nums) {
        if (count == 0) candidate = x;
        count += (x == candidate) ? 1 : -1;
    }
    return candidate; // majority is guaranteed, so no verification pass is needed
}
```

## Follow-ups an interviewer might ask
- What if a majority element is not guaranteed? (Add a second pass that counts the candidate and checks it exceeds n/2.)
- Generalize to elements that appear more than n/3 times. (Boyer-Moore with two candidates, which returns at most 2 elements.)
- How would you find the majority in a stream or in data too large for memory? (Boyer-Moore is a single pass with O(1) state. It can also be merged across shards by combining candidate and count pairs.)

## Learn: Boyer-Moore Voting

**Why here:** It finds the majority in one pass with O(1) extra space, instead of O(n + k log k) time and O(k) space for counting and then sorting.

**How it applies here:** Keep one candidate and a counter. The same value adds one, any other value takes one away, and when the counter reaches zero the next value becomes the candidate. The majority survives because it outnumbers every other value combined.

**Read:** [Boyer-Moore Voting on GeeksforGeeks](https://www.geeksforgeeks.org/theory-of-computation/boyer-moore-majority-voting-algorithm/)
