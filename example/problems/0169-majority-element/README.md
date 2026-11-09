# 169. Majority Element

- **Difficulty:** Easy
- **Solved:** 2026-11-06
- **Topics:** Array, Hash Table, Divide and Conquer, Sorting, Counting
- **Problem:** https://leetcode.com/problems/majority-element/
- **Language:** Java
- **Runtime:** 17 ms (beats 18.3%)
- **Memory:** 54.7 MB (beats 93.7%)
- **Interviewer review:** [Lean No Hire](REVIEW.md)
- **Learn:** [Boyer-Moore Voting](REVIEW.md#learn-boyer-moore-voting)

## Summary

> The problem asks for the value that appears more than half the time in an array, and such a value is guaranteed to exist. The solution counts how often each value occurs using a HashMap, sorts the map entries by count in descending order, and returns the key of the first entry. This takes O(n + k log k) time, where k is the number of distinct values (O(n log n) in the worst case), and O(k) extra space for the map and the entry list.
>
> *Written by Claude*

## Problem

*The full problem statement goes here when **Include problem statement** is on. It's LeetCode's text, so it's
left out of this public sample: [read it on LeetCode](https://leetcode.com/problems/majority-element/).*
