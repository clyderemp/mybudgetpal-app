export let savingsData = {};
export let totalSavingsVal = 0;
export let savingsAccountPerUser = {};

export async function loadSavingsData(){
    console.log(savingsData)
    for(const key in savingsData){
        const obj = savingsData[key];
        const value = parseFloat(obj?.value) || 0;
        const reportedBy = obj?.reportedBy?.replaceAll('Me - ','');
        totalSavingsVal += value;
        
        if(savingsAccountPerUser[reportedBy] ===  undefined){
            savingsAccountPerUser[reportedBy] = {
                name: reportedBy,
                amount: 0,
                lastReport: obj.date
            };
        }
        savingsAccountPerUser[reportedBy].amount += value;
    }
}