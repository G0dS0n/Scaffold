
    var linkElement = document.querySelector(".customAlertLink");
    if (linkElement) {
        linkElement.addEventListener("click", function(event) {
            event.preventDefault();
            alert('Hello from GitHub-hosted JS!');
        });
    }
