import { uid } from "../../../main.js";
import { allTransactions } from "../../model/allTransactionsData.js";
import { currencySymbol, exchangeRates, selectedCurrencyCode } from "./currencyConverter.js";
import { launchInvoiceForm } from "./invoiceForm.js";
import { checkIfObjectContainsSearchInput } from "./searchHandler.js";
import { launchConfirmationModal, launchSuccessModal } from "./sweetAlertModals.js";
import { formatToMoneyValue } from "./valueFormatter.js";


let searchValInput = '', targetId = '';

export async function launchInvoiceTable(){
    targetId = null;
    await loadDateFilterVal();
    await loadTable();
    await searchBarHandler();
    await buttonListeners();

}

async function loadDateFilterVal(){
    const latestIndex = Object.keys(allTransactions).length;
    let startDate = (allTransactions[JSON.stringify(latestIndex-1)].date)?.replaceAll('-','/');
    let endDate = (allTransactions['0'].date)?.replaceAll('-','/');

    $('#date-filter-val').text(`(${startDate} to ${endDate})`);
}

async function loadTable(){
    let resultsVal = 0;
    $('#full-invoice-table').empty();
        let filteredTransactions = Object.fromEntries(
            Object.entries(allTransactions).filter(([key, transaction]) => transaction.item_id !== targetId)
        );
        await Object.values(filteredTransactions).forEach(async (data, index) => {
            const includeThisData = await checkIfObjectContainsSearchInput(data, searchValInput);
            // console.log(deletedIndex.includes(index))
            if(includeThisData ){
                resultsVal++;
                let reportedBy = data?.reportedBy?.replaceAll('Me - ','')?.split(' ');
                    reportedBy = reportedBy[0]+' '+reportedBy[reportedBy.length-1][0]+'.';
                const date = data?.date;
                const category = data?.category;
                const type = data?.type?.split('(')[0];
                const conversionBasedOnCurrency = data.currency ===  selectedCurrencyCode ? 1 : data.currency !== undefined ? exchangeRates[data.currency] : exchangeRates['CAD'];
                const amount = currencySymbol +' '+ (data?.value / conversionBasedOnCurrency).toFixed(2);
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
                                <td>
                                    <a class="action-btn btn btn-primary rounded py-0 px-2 text-white" actionType="edit" id="${data.item_id}" data="${data}">Edit</a>
                                    <a class="action-btn btn btn-warning rounded py-0 px-2 text-white" actionType="delete" id="${data.item_id}">Delete</a>
                                </td>
                            </tr>`;
                $('#full-invoice-table').append(html);
                $('#result-text').html(`<strong>(${resultsVal} results)</strong>`)
            }
    });
}

async function searchBarHandler(){
    $('#invoice-search').on('keydown', async function(){
        searchValInput = $(this).val();
        if(searchValInput?.length !== 0 ){
            $('#clear-search').show();
        } else {
            $('#clear-search').hide();
        }
        await loadTable();
    });

    $('#clear-search').click(async ()=>{
        searchValInput = '';
        $('#invoice-search').val(searchValInput);
        await loadTable();
    });
}

async function buttonListeners(){

    $('.action-btn').click(async function(e){
        e.preventDefault();
        const actionType = $(this).attr('actionType');
        const itemID = $(this).attr('id'); 
        targetId = itemID;
        const data = Object.entries(allTransactions)
                    .find(([key, transaction]) => transaction.item_id === targetId)
                    ?.[1]; 

        if(actionType?.toLowerCase() === 'delete'){
            const confirmed = await launchConfirmationModal(`${actionType}`,`Are you sure you would like to ${actionType} this transaction?`);
            if(confirmed){
                await launchSuccessModal(actionType,'Invoice has been deleted!');
            }
        } else {
            $('#invoiceTableModal').modal('hide');
            $('#invoiceForm').modal('show');
            await launchInvoiceForm(true, data, true);
        }
        // deletedIndex.push(index);
        console.log(itemID)
        // $('#invoice-search').trigger('keydown');
    });
}