import { fetchCoUsersData } from "../presenter/services/fetchCoUsersData.js";
export let coUsersDataVal = [];

export const coUsersData = async() => {
    // localStorage?.clear();
    coUsersDataVal = await fetchCoUsersData();
    loadCoUsersOntoTopBarNav(coUsersDataVal)
}

async function loadCoUsersOntoTopBarNav(coUserDataVal){
    $('#coUser-totalVal').text(coUserDataVal?.length);
    coUserDataVal?.forEach(coUser => {
        const fname = coUser?.fname;
        const lname = coUser?.lname;
        const fullName = fname+' '+lname;
        const dob = coUser?.dob;


        const html = `<a href="#" class="iq-sub-card" >
                        <div class="media align-items-center">
                            <div class="">
                                <img class="avatar-40 rounded" src="../../images/logo.png" alt="">
                            </div>
                            <div class="media-body ml-3">
                                <h6 class="mb-0 ">${fullName}</h6>
                                <small class="float-left font-size-12">DOB: ${dob}</small>
                            </div>
                        </div>
                    </a>`
        $('#coUsersNavTab').append(html);
    });
}