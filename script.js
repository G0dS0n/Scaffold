console.log("Script loaded!");
document.addEventListener("DOMContentLoaded", function() {
    var link = document.querySelector(".customAlertLink");
    
    if (link) {
        link.addEventListener("click", function(event) {
            event.preventDefault();
            alert("This alert is from the script hosted on GitHub!");
        });
    }
});
