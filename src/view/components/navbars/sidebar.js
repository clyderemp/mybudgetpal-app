export async function sidebarActionHandlers() {
    const currentUrl = window.location.href;
    let page = currentUrl?.toString()?.split('/');
        page = page[page?.length-2];

        // Check if the current page is the 'home' page
        // if (currentUrl.includes('home')) {
            console.log('here')
            // Expand the Dashboard menu
            $(`#side-navbar a[href="#${page}"]`).attr('aria-expanded', 'true'); // Set aria-expanded to true
            $(`#${page}`).addClass('show'); // Add 'show' class to the submenu

            // Mark the Dashboard li as active
            $('#side-navbar li').removeClass('active'); // Remove active class from all li elements

            // Add the 'active' class to the li that contains the specific link (Dashboard)
            $(`#side-navbar a[href="../../pages/${page}/"]`).closest('li').addClass('active'); 

            // Add 'active' class to the parent <li> (this can be useful for top-level <li>)
            $(`#side-navbar a[href="#${page}"]`).closest('li').addClass('active');
        // }
};
