import { fetchCurrentUserData } from "../presenter/services/fetchCurrentUserData.js";
export let currentUserDataVal = null;

export const currentUserData = async() => {
    // localStorage?.clear();
    currentUserDataVal = await fetchCurrentUserData();
    await loadUsersNameOnTopBar(currentUserDataVal);
}

const loadUsersNameOnTopBar = async (currentUserDataVal) => {
    const fullName = currentUserDataVal?.fname +' '+currentUserDataVal?.lname;
    $('#currentUserFullName').text(fullName);
    $('#greetings-topbar').text('Hi '+currentUserDataVal?.fname+' '+currentUserDataVal?.lname[0]+'. !');
    $('#dob-topbar').text('DOB: '+currentUserDataVal?.dob);
    $('#sidebar-fname').text('Welcome '+currentUserDataVal?.fname+'!')
    $('#memberSince').text(`Member since ${currentUserDataVal?.creationDate}`);
}