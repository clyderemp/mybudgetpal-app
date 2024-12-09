export let incomeData = {};
export let totalIncomeVal = 0;
export let incomeBalanceTracker = {};

export async function loadIncomeData(){
    for(const key in incomeData){
        const obj = incomeData[key];
        const month = obj.date?.split('-')[1];
        const value = parseFloat(obj?.value) || 0;
        totalIncomeVal += value;

        if(incomeBalanceTracker[month] === undefined){
            incomeBalanceTracker[month] = 0;
        }
        incomeBalanceTracker[month] += value;
    }
}