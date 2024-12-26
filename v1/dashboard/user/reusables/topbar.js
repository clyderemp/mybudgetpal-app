// Function to load the header and buttons HTML and insert it into the page
export function loadHeaderComponent(leftTitle, rightTitle) {
    fetch('../reusables/header-component.html')  // Path to the header-buttons HTML file
        .then(response => response.text())
        .then(data => {
            const container = document.getElementById('header-title-container');
            container.innerHTML = data;
            console.log(leftTitle, rightTitle)
            // Set the customizable title
            if (leftTitle && rightTitle) {
                // $('#header-title.container').html(leftTitle)
                container.querySelector('#dashboard-leftTitle').textContent = leftTitle;
                container.querySelector('#dashboard-rightTitle').textContent = rightTitle;
            }

            // Optionally, initialize Feather icons after loading the header
            feather.replace(); // Ensure you have Feather Icons included in your project
        })
        .catch(error => console.error('Error loading the header and buttons:', error));
    fetch('../reusables/topbar-component.html')  // Path to the header-buttons HTML file
        .then(response => response.text())
        .then(data => {
            const container = document.getElementById('navbar-container');
            if(container){
                // container?.innerHTML = data;
            }
            // Set the customizable title
            // if (leftTitle && rightTitle) {
            //     // $('#header-title.container').html(leftTitle)
            //     container.querySelector('#dashboard-leftTitle').textContent = leftTitle;
            //     container.querySelector('#dashboard-rightTitle').textContent = rightTitle;
            // }

            // Optionally, initialize Feather icons after loading the header
            feather.replace(); // Ensure you have Feather Icons included in your project
        })
        .catch(error => console.error('Error loading the header and buttons:', error));
}

// Call the function to load the header and buttons with a customizable title
// Example: loadHeaderButtons('Admin Dashboard');