import { uid } from "../../../main.js";
import { allTransactions } from "../../model/allTransactionsData.js";
import { currencySymbol, currentExchangeRateVal } from "./currencyConverter.js";
import { formatToMoneyValue } from "./valueFormatter.js";

export async function launchInvoiceTable(){
    await loadTable();
}

async function loadTable(){
    allTransactions.forEach(async (data) => {
        let reportedBy = data?.reportedBy?.replaceAll('Me - ','')?.split(' ');
            reportedBy = reportedBy[0]+' '+reportedBy[reportedBy.length-1][0]+'.';
        const date = data?.date;
        const category = data?.category;
        const type = data?.type?.split('(')[0];
        const amount = currencySymbol +' '+ await formatToMoneyValue(parseFloat(data?.value) * currentExchangeRateVal);
        const paidTo = data?.transaction;
        const html = `<tr>
                        <td>${date}</td>
                        <td>
                            <div class="badge badge-pill badge-${
                                category === 'expenses' ? 'danger' : category === 'savings' ? 'success' : 'warning'
                            }">${category}</div>
                        </td>
                        <td>${type}</td>
                        <td>${amount}</td>
                        <td>${paidTo?.length > 20 ? paidTo.slice(0,20)+'...' : paidTo}</td>
                        <td>${reportedBy}</td>
                    </tr>`

        $('#full-invoice-table').append(html);
    });
}