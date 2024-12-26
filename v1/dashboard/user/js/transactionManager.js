import { db } from '../../../js/firebase.js';
import { month_strings } from '../js/dataFile.js';
import { doc, deleteDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js"; 
import { convertTo2_Decimals, numberWithCommas } from './dashboard-analytics.js';

var uid = await localStorage.getItem('uid');
let exchange_rate = JSON.parse(await localStorage.getItem('exchange_rate'));
let currency = exchange_rate?.code;
        exchange_rate = exchange_rate?.value;
const table_header = [
    'TRANSACTION DATE',
    'CATEGORY',
    'TYPE',
    'MERCHANT',
    'AMOUNT '+'('+currency+')',
    'AMOUNT (CAD)',
    'PAYMENT METHOD',
    'NOTES',
    'PERSON',
    ''
]

//GENERATING CO USERS TABLE
export async function generateTransactionTable(){
    var date = (new Date().toLocaleDateString())+' '+(new Date().toLocaleTimeString());
    $('#report-update').append(date);

    var transactions = JSON.parse(localStorage.getItem(uid+'-transactionData'));
    var html = '<tr>';
    for(var i = 0; i < table_header.length; i++){

        html += '<th id="sort-'+table_header[i]+'">'+table_header[i]+'</th>';

    }
    html+='</tr>'
    $('#transaction-table-header').html(html);

    for(var key in transactions){
        var docData = transactions[key];
                var id = docData.item_id;
                var title = docData.transaction;
                var note = docData.note;
                const stored_exchange_rate = docData.exchange_rate !== exchange_rate? docData.exchange_rate : exchange_rate;
                var value = docData.value;
                var paymentMethod = capitalizeFirstLetter(docData.paymentMethod);
                var creation_date = new Date(docData.creation_date).toLocaleDateString();
                    creation_date = reformatDate((creation_date).split('/'));
                    
                var date = (docData.date).split('-');
                    date = date[1]+'/'+date[2]+'/'+date[0];
                    date = reformatDate((date).split('/'));

                var category = docData.category.toUpperCase();
                var type = docData.type?.toUpperCase();
                var reportedBy = docData.reportedBy;
                    reportedBy = reportedBy.replace('Me - ','');
                    reportedBy = reportedBy.split(' ');
                    reportedBy = reportedBy[0] +' '+ reportedBy[reportedBy.length-1][0]+'.';
                
                if(category == 'EXPENSES' || category == 'CREDIT'){
                    var color = 'danger';
                }else if(category == 'SAVINGS'){
                    var color = 'warning';
                }else if(category == 'INCOME'){
                    var color = 'success';
                }
                var table_template = '<tr class="text-sm">'+
                                        //'<td>'+creation_date+'</td>'+
                                        '<td>'+date+'</td>'+
                                        '<td><span class="badge bg-'+color+'">'+category+'</span></td>'+
                                        '<td><span class="badge bg-secondary">'+type+'</span></td>'+
                                        '<td>'+title+'</td>'+
                                        '<td> '+numberWithCommas(convertTo2_Decimals(value * (exchange_rate)))+' '+currency+'</td>'+
                                        '<td> '+numberWithCommas(convertTo2_Decimals(value))+' CAD</td>'+
                                        '<td>'+paymentMethod+'</td>'+
                                        '<td>'+note+'</td>'+
                                        '<td>'+reportedBy+'</td>'+
                                        '<td class="btn-container"><button class="btn btn-primary btn-sm edit-item-btn" id="edit.'+id+'"><i class="fa-solid fa-pen-to-square"></i></button> &nbsp;&nbsp; '+
                                        '<button class="btn btn-danger btn-sm btn-circle delete-btn" id="delete.'+id+'"><i class="fa-solid fa-trash-can"></i></button></td>'+
                                    '</tr>';
                $('#transaction-table-body').append(table_template);
    }
    try{
        $('#transaction-table').DataTable({
            "order": [0, 'des']
        });

        //$('#sort-TRANSACTION DATE').click();

        if(localStorage.getItem('lastSearch')!=null){

            var search_string = JSON.parse(localStorage.getItem('lastSearch'));
            var length_value = JSON.parse(localStorage.getItem('lastPageSize'));
            $('#transaction-table_filter input').val(search_string);
            $('#transaction-table_filter input').trigger(jQuery.Event('keyup', { keyCode: 13 }));
            $('#transaction-table_length select').val(length_value);
            
       }
    }catch(err){

    }
}

$(function(){

    var currentPage = window.location.pathname.toString();
    if(currentPage.includes('transactions-report')){
        $('#transaction-table_filter input').val( localStorage.getItem('search_val'));
        setInterval(function(){
            localStorage.setItem('lastSearch', JSON.stringify($('#transaction-table_filter input').val()));
            localStorage.setItem('lastPageSize', JSON.stringify($('#transaction-table_length select').val()));
        }, 1000);
    }


    $(document).on('click',".edit-item-btn", function(){
        var search_val = $('#transaction-table_filter input').val();
        localStorage.setItem('search_val', search_val);
        var item_id = (this.id).split('.');
            item_id = item_id[1];
            localStorage.setItem('selected_item', item_id);
            localStorage.setItem('lastSearch', JSON.stringify($('#transaction-table_filter input').val()));
            localStorage.setItem('lastPageSize', JSON.stringify($('#transaction-table_length select').val()));
            window.location.replace('edit.html');
    });

    $(document).on('click',".delete-btn", function(){
        var id = (this.id).split('.');
        openDeleteModal(id[1]);
    });

    $(document).on('click',".cancel-btn", function(){
        $('#DeleteModal').hide();
    });

    $('#confirm-delete-item').click(function(){
        var item = $('#DeleteText').text();
        var id = item.split(': ');
        deleteItemFromFirestoreDB(id[1]);
    });


});

function openDeleteModal(id){
    // Get the modal
        var modal = document.getElementById("DeleteModal");

        var span = document.getElementsByClassName("close")[0];

        modal.style.display = "block";

        window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
}

$('#DeleteText').text("ITEM ID: "+id);
}

function deleteItemFromFirestoreDB(item_id){
    localStorage.removeItem(uid+'-transactionData');
    deleteDoc(doc(db, "users/"+uid+'/transactions', item_id)).
        then(function(err){

            //window.alert("Item has been permanently removed!");
            var lastDelete = (new Date()).toDateString().split(' ').slice(1).join(' ');
            var docData = {
                lastDelete: lastDelete
            };

            updateDoc(doc(db, "users", uid), docData);
            location.reload();
    });
}


function reformatDateWithShortMonth(date){
    var dateSplit = date.split('-');
    var month = dateSplit[1];
    var day = dateSplit[2];
    var year = dateSplit[0];

    const date_string = month_strings[month-1]+' '+day+', '+year;

    return date_string;
}

function reformatDateWithLongMonth(date){

}

function reformatDate(date){
    if(date[0].length < 2){
        date[0] = '0'+date[0];
    }

    if(date[1].length < 2){
        date[1] = '0'+date[1];
    }
    return date[2]+'/'+date[0]+'/'+date[1];
}

function capitalizeFirstLetter(str){
    
   return str.charAt(0).toUpperCase() + str.slice(1);
}