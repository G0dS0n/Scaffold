var link = document.querySelector(".customAlertLink");
        if (link) {
            link.addEventListener("click", function(event) {
                event.preventDefault();  // Prevent the default action (navigation) of the link
                alert("Alerting");
            });
        }
