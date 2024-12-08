import { fetchCurrentUserData } from "../presenter/services/fetchCurrentUserData.js";
export let currentUserDataVal = await localStorage.getItem('currentUserData');

export const currentUserData = async() => {
    currentUserDataVal = await localStorage.getItem('currentUserData');


    console.log(currentUserDataVal)
    if(currentUserDataVal === null){
        currentUserDataVal = await fetchCurrentUserData();
    }

    await loadUsersNameOnTopBar(currentUserDataVal);
    console.log(currentUserDataVal)
}

const loadUsersNameOnTopBar = async (currentUserDataVal) => {
    const fullName = currentUserDataVal?.fname +' '+currentUserDataVal?.lname;
    $('#currentUserFullName').text(fullName);
    $('#greetings-topbar').text('Hi '+currentUserDataVal?.fname+' '+currentUserDataVal?.lname[0]+'. !');
    $('#dob-topbar').text('DOB: '+currentUserDataVal?.dob);
    $('#sidebar-fname').text('Welcome '+currentUserDataVal?.fname+'!')
    $('#memberSince').text(`Member since ${currentUserDataVal?.creationDate}`);
}