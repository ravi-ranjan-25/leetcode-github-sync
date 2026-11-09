class Solution {
    public int majorityElement(int[] nums) {
        HashMap<Integer,Integer> map = new HashMap<Integer,Integer>();
        for(int i=0;i<nums.length;i++){
            int key=nums[i];
            map.put(nums[i],map.getOrDefault(key,0)+1);
        }
        ArrayList<Map.Entry<Integer,Integer>> list = new ArrayList(map.entrySet());

        Collections.sort(list,(a,b) -> 
        {
            
            if(b.getValue() > a.getValue()) return 1;
                    if(a.getValue() > b.getValue()) return -1;
                    return 0;

    });

        return list.get(0).getKey();

    }
}
