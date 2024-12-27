import { uid } from "../../../main.js";
import { allTransactions } from "../../model/allTransactionsData.js";
import { currencySymbol, exchangeRates, selectedCurrencyCode } from "./currencyConverter.js";
import { launchInvoiceForm } from "./invoiceForm.js";
import { checkIfObjectContainsSearchInput } from "./searchHandler.js";
import { launchConfirmationModal, launchSuccessModal } from "./sweetAlertModals.js";
import { formatToMoneyValue } from "./valueFormatter.js";


let searchValInput = '', targetId = '';
let sortedTransactions = null;

export async function launchInvoiceTable(){
    targetId = null;
    await sortTransactions();
    await loadDateFilterVal();
    await loadTable();
    await searchBarHandler();
    await buttonListeners();
}

async function sortTransactions(){

    sortedTransactions = await Object.entries(allTransactions)
    .filter(([key, transaction]) => transaction.item_id !== targetId) // Filter out the targetId
    .sort(([keyA, transactionA], [keyB, transactionB]) => {
        // Sort by date in descending order (most recent first)
        const dateA = new Date(transactionA.date); // Assuming `date` is a valid date string
        const dateB = new Date(transactionB.date); // Ensure date is in a comparable format
        return dateB - dateA; // Compare for descending order
    });

}

async function loadDateFilterVal(){
    const latestIndex = Object.keys(allTransactions).length;
    let startDate = (allTransactions[JSON.stringify(latestIndex-1)].date)?.replaceAll('-','/');
    let endDate = (allTransactions['0'].date)?.replaceAll('-','/');

    $('#date-filter-val').text(`(${startDate} to ${endDate})`);
}

let currentPage = 1;  // Track the current page
let recordsPerPage = 10;  // Show 10 records per page

async function loadTable() {
    let resultsVal = 0;
    const totalPages = Math.ceil(sortedTransactions.length / recordsPerPage);  // Total number of pages

    // Paginate the sortedTransactions (get the correct slice for the current page)
    const startIdx = (currentPage - 1) * recordsPerPage;
    const endIdx = startIdx + recordsPerPage;
    const transactionsForCurrentPage = sortedTransactions?.slice(startIdx, endIdx);
    
    // Empty the table before populating new data
    $('#full-invoice-table').empty();
    let prevDate = null;  // Variable to track the previous date
    let indexIsEvenOrOdd = 0;  // This will hold 0 or 1 based on whether it's even or odd index
    await Promise.all(transactionsForCurrentPage?.map(async (data, index) => {
        const includeThisData = await checkIfObjectContainsSearchInput(data, searchValInput);
        index = parseInt(data[0]);
        data = data[1];
        if (includeThisData) {
            resultsVal++;
            let reportedBy = data?.reportedBy?.replaceAll('Me - ','')?.split(' ');
            reportedBy = reportedBy[0]+' '+reportedBy[reportedBy.length-1][0]+'.';
            const date = new Date(data?.date).toLocaleDateString();
            const category = data?.category;
            const type = data?.type?.split('(')[0];
            const amount = currencySymbol + ' ' + (data?.value).toFixed(2);
            const paidTo = data?.transaction;

            // Check if the current date is the same as the previous date
            let showDate = true;
            if (prevDate === data?.date) {
                indexIsEvenOrOdd = (indexIsEvenOrOdd === 0) ? 0 : 1;
                showDate = false;
            } else {
                indexIsEvenOrOdd = (indexIsEvenOrOdd === 0) ? 1 : 0;
            }
            const rowColor = indexIsEvenOrOdd === 0 ? 'bg-light' : 'bg-white';
            prevDate = data?.date;

            const html = `<tr class="${rowColor}">
                            <td><a href="javascript:void(0)" class="action-btn" actionType="edit" id="${data?.item_id}">${showDate ? date : ''}</a></td>
                            <td>
                                <div class="badge badge-pill badge-${
                                    category === 'expenses' ? 'danger' : category === 'savings' ? 'success' : 'warning'
                                }">${category}</div>
                            </td>
                            <td><a href="javascript:void(0)" class="action-btn" actionType="edit" id="${data?.item_id}">${type}</a></td>
                            <td><a href="javascript:void(0)" class="action-btn" actionType="edit" id="${data?.item_id}">${amount}</a></td>
                            <td><a href="javascript:void(0)" class="action-btn" actionType="edit" id="${data?.item_id}">${paidTo?.length > 20 ? paidTo.slice(0,20)+'...' : paidTo}</a></td>
                            <td><a href="javascript:void(0)" class="action-btn" actionType="edit" id="${data?.item_id}">${reportedBy}</a></td>
                            <td>
                                <a class="action-btn btn btn-warning rounded py-0 px-2 text-white" actionType="delete" id="${data.item_id}">Delete</a>
                            </td>
                        </tr>`;
            $('#full-invoice-table').append(html);
        }
    }));

    // Update result text to show number of results
    const resultText = searchValInput?.length > 0
                        ? `<br><strong>Filter Result: ${resultsVal} results</strong>`
                        : `<br><strong>Transaction Invoices: ${sortedTransactions.length} results</strong>`
    $('#result-text').html(resultText);
    // Show pagination controls
    updatePaginationControls(totalPages);
    buttonListeners();


    // Function to change the current page and reload the table
    $('.page-btn').off('click').click(async function changePage() {
        let pageNumber = $(this).attr('pageNumber');
        currentPage = pageNumber;
        await loadTable();
    });
}

// Function to update pagination controls
function updatePaginationControls(totalPages) {
    const paginationContainer = $('#pagination-container');
    paginationContainer.empty();  // Clear the existing pagination

    // Add "Previous" button
    if (currentPage > 1) {
        paginationContainer.append(`<button class="btn page-btn" pageNumber="${parseInt(currentPage) - 1}">Previous</button>`);
    }

    // Add page number buttons
    for (let i = 1; i <= totalPages; i++) {
        paginationContainer.append(`<button class="btn page-btn ${i === parseInt(currentPage) ? 'btn-primary' : ''}" pageNumber="${i}">${i}</button>`);
    }

    // Add "Next" button
    if (currentPage < totalPages) {
        paginationContainer.append(`<button class="btn page-btn" pageNumber="${parseInt(currentPage) + 1}">Next</button>`);
    }
}



async function searchBarHandler(){
    $('#invoice-search').on('keydown', async function(){
        searchValInput = $(this).val();
        currentPage = 1;
        if(searchValInput?.length !== 0 ){
            recordsPerPage = 9999;
            $('#clear-search').show();
        } else {
            recordsPerPage = 10;
            $('#clear-search').hide();
        }
        await loadTable();
        await buttonListeners();
    });

    $('#clear-search').off('click').click(async ()=>{
        searchValInput = '';
        $('#invoice-search').val(searchValInput);
        await loadTable();
        await buttonListeners();
    });
}

async function buttonListeners(){

    $('.action-btn').off('click').click(async function(e){
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
        // $('#invoice-search').trigger('keydown');
    });

    $('#invoice-add').click(async ()=>{
        $('#invoiceTableModal').modal('hide');
        $('#invoiceForm').modal('show');
        await launchInvoiceForm(false, null, true);
    });
}