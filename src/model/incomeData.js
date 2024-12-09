export let incomeData = {};
export let totalIncomeVal = 0;

export async function loadIncomeData(){
    for(const key in incomeData){
        const obj = incomeData[key];
        const value = parseFloat(obj?.value) || 0;
        totalIncomeVal += value;
    }
}