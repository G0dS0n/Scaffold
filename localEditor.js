var ScaffoldClient = (function (m, $) {

    m.modules = [
            {
                id: 'carousel_1'
            },
            {
                id: 'basic_footer_324'
            },
            {
                id: 'basic_module_cards_326'
            },
            {
                id: 'callout_box_10'
            },
            {
                id: 'page_banner_8'
            },
            {
                id: 'page_banner_w_image_96'
            },
            {
                id: 'banner_progress_pie_9'
            },
            {
                id: 'tabs_24'
            },
            {
                id: 'video_activities_11'
            }];

	m.oninitset = false;
    m.onloadset = false;

    m.loadcheck = false;
    m.loadcount = 0;

    m.options = {
        source: 'api',
        origin: document.location.origin,
        afterInit: () => {
            /** Variables configuration */

ScaffoldClient.preloadPromises = [];
ScaffoldClient.courseData = {
    currentModule: {},
    currentActivities: [],
    modules: [],
    saveModuleItems: function (data) {/* save all the module items information */
        if (typeof data !== 'object' || data.length === 0) {
            return Promise.resolve(false);
        }
        ScaffoldClient.courseData.modules = ScaffoldClient.courseData.modules.concat(Array.from(data));
        return Promise.resolve();
    },
    saveCurrentModule: function (data) {/* save the module information for current page */
        if (typeof data !== 'object' || data.length === 0) {
            return Promise.resolve(false);
        }
        var modules = [];
        for (let module of data) {
            if (Array.from(module.items).find(item => item.title.trim() === ScaffoldClient.getPageTitle().trim())) {
                modules.push(module);
            }
        }

        /* It is possible the user insert same page in two different modules. We only handle the first one. */
        if (modules.length > 0) {
            ScaffoldClient.courseData.currentModule = modules[0];
            return Promise.resolve();
        } else {
            return Promise.resolve();//console.log("SaveCurrentModule: the page is not in any module"));
        }
    },
    saveActivityPage: function (data) {
        if (typeof data !== 'object' || data.length === 0) {
            return Promise.resolve(false);
        }
        ScaffoldClient.courseData.currentActivities.push(data);
        return Promise.resolve();
    }
};

/** End of variables configuration */

/** Pagination Configuration */

/**
 * Bottlneck js is a library that allows you to throttle requests. This is an
 * advanced section for those who want to tweak the settings or who have large
 * classes and find that the report is not running. If you exceed the
 * x-rate-limit-remaining value, then Canvas will shut down the requests.
 */

/**
 * minTime specifies the number of milliseconds you must wait between
 * successive API calls. Making them all at the same time imposes a penalty
 * that can quickly deplete the Canvas x-rate-limit-remaining value. This will
 * have a greater impact than maxConcurrent and if your network calls are too
 * excessive, try increasing this first.
 */
ScaffoldClient.minTime = 30;

/**
 * maxConcurrent specifies the maximum number of concurrent requests that can
 * be made.
 */
ScaffoldClient.maxConcurrent = 25;

ScaffoldClient.failedFetches = {};
ScaffoldClient.limiter = null;
ScaffoldClient.minimumRateRemaining = null;
ScaffoldClient.maximumRequestCost = null;

ScaffoldClient.initBottleneck = function() {
    return new Promise(function (res, rej) {
        if (typeof Bottleneck === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/bottleneck@2/light.min.js';
            script.onload = function () {
                ScaffoldClient.initBottleneck().then(
                    res()
                );
            };
            document.head.appendChild(script);
        } else {
            ScaffoldClient.limiter = new Bottleneck({
                'maxConcurrent': ScaffoldClient.maxConcurrent,
                'minTime': ScaffoldClient.minTime,
            });
            //console.log("bottleneck is resolved!");
            res();
        }
    })
}

// set up bottleneck for API calls
// pre-load some api calls here
ScaffoldClient.initBottleneck().then(function () {
    if (ScaffoldClient.getCourseID()) {
        // Get current module id
        let currentModuleUrl = "/api/v1/courses/" + ScaffoldClient.getCourseID() + "/modules?per_page=100&include[]=items&search_term=" + ScaffoldClient.getPageTitle();
        ScaffoldClient.preloadPromises.push(ScaffoldClient.fetchResults(currentModuleUrl, ScaffoldClient.courseData.saveCurrentModule));

        // get all modules and module items information
        let moduleItemUrl = origin + "/api/v1/courses/" + ScaffoldClient.getCourseID() + "/modules?per_page=100&include[]=items";
        ScaffoldClient.preloadPromises.push(ScaffoldClient.fetchResults(moduleItemUrl, ScaffoldClient.courseData.saveModuleItems));
    }
});

ScaffoldClient.checkFailed = function() {
    const urls = Object.keys(ScaffoldClient.failedFetches);
    if (urls.length > 0) {
        //console.log("failed fetches found: " + urls);
        ScaffoldClient.limiter.updateSettings({
            'maxConcurrent': Math.floor(Math.max(5, ScaffoldClient.maxConcurrent / 2)),
            'minTime': ScaffoldClient.minTime < 30 ? 45 : Math.floor(ScaffoldClient.minTime * 1.5),
        });
        return ScaffoldClient.fetchResults(urls);
    } else {
        return Promise.resolve(false);
    }
}

ScaffoldClient.fetchResults = function (url, callback) {
    if (typeof url === 'object') {
        const p = [];
        if (Array.isArray(url)) {
            url.forEach(function (u) {
                p.push(ScaffoldClient.fetchResult(u, callback));
            });
        } else {
            const keys = Object.keys(url);
            keys.forEach(function (u) {
                p.push(ScaffoldClient.fetchResult(u, url[u]));
            });
        }
        return p.length > 0 ? Promise.all(p) : Promise.resolve(false);
    } else {
        return ScaffoldClient.fetchResult(url, callback);
    }
}

ScaffoldClient.fetchResult = function(url, callback) {
    let links;
    return ScaffoldClient.limiter.schedule(function () {
        const options = {
            'method': 'GET',
            'headers': {
                'accept': 'application/json',
            },
            'credentials': 'same-origin',
            'timeout': 30000,
        };
        return fetch(url, options);
    }).then(function (res) {
        if (res.ok) {
            links = res.headers.get('link') ? ScaffoldClient.extractLinks(res.headers.get('link')) : null;
            return res.json();
        } else if (res.status === 403) {
            if (typeof ScaffoldClient.failedFetches[res.url] !== 'undefined') {
                if (debug) {
                    console.log('FETCH FAILED A SECOND TIME');
                    console.log(res.headers.entries());
                }
                return Promise.reject('A fetch failed for the second time, giving up.');
            } else {
                ScaffoldClient.failedFetches[res.url] = callback;
                if (debug) {
                    console.log(`FAILED FAILED : ${res.url}`);
                }
            }
            return Promise.resolve(true);
        } else {
            return Promise.reject(`Got an HTTP status of ${res.status}`);
        }
    }).then(function (json) {
        if (typeof json === 'object') {
            return typeof callback === 'function' ? callback(json, links) : Promise.resolve(json);
        } else {
            return Promise.resolve(false);
        }
    }).then(function () {
        const additionalLinks = ScaffoldClient.nextPage(links);
        if (additionalLinks !== false && additionalLinks.length > 0) {
            return ScaffoldClient.fetchResults(additionalLinks, callback);
        } else {
            return Promise.resolve(true);
        }
    }).catch(function (e) {
        // Suppress warnings when canceled
        if (!(e instanceof Bottleneck.BottleneckError)) {
            console.log(`Error: ${e}`);
        }
    });
}

ScaffoldClient.calculateLimits = function(res) {
    const xremaining = parseFloat(res.headers.get('x-rate-limit-remaining'));
    const xcost = parseFloat(res.headers.get('x-request-cost'));
    if (ScaffoldClient.minimumRateRemaining === null || xremaining < ScaffoldClient.minimumRateRemaining) {
        ScaffoldClient.minimumRateRemaining = xremaining;
    }
    if (ScaffoldClient.maximumRequestCost === null || xcost > ScaffoldClient.maximumRequestCost) {
        ScaffoldClient.maximumRequestCost = xcost;
    }
    const outstat = [Date.now().toString(), xremaining, xcost, res.url];
    //console.log(outstat.join('\t'));
}

ScaffoldClient.extractLinks = function (hdr) {
    const linkRegex = new RegExp('^<(.*?)>; rel="(current|first|last|next|prev)"$');
    const linkStr = hdr.split(',');
    const links = {};
    for (let i = 0; i < linkStr.length; i++) {
        const matches = linkRegex.exec(linkStr[i]);
        if (matches) {
            const linkUrl = matches[1];
            const linkType = matches[2];
            links[linkType] = linkUrl;
        }
    }
    return links;
}

ScaffoldClient.paginationInfo = function(link) {
    if (typeof link !== 'string' || link === '') {
        return false;
    }
    const url = new URL(link);
    const params = url.searchParams;
    const page = params.get('page');
    const perPage = params.get('per_page') || 10;
    const isNumeric = /^[0-9]+$/.test(page);
    return {
        'url': url,
        'page': isNumeric ? parseInt(page, 10) : page,
        'perPage': perPage,
        'isNumeric': isNumeric,
    };
}

ScaffoldClient.nextPage = function (links) {
    if (!links || typeof links === 'undefined' || typeof links.next === 'undefined') {
        return false;
    }
    const results = [];
    if (typeof links.last !== 'undefined') {
        const next = paginationInfo(links.next);
        const last = paginationInfo(links.last);
        if (next.isNumeric && next.page === 2 && last.isNumeric) {
            results.push(links.next);
            const url = next.url;
            for (let i = next.page; i < last.page; i++) {
                url.searchParams.set('page', i + 1);
                results.push(url.toString());
            }
        }
    }
    if (results.length === 0) {
        results.push(links.next);
    }
    return results.length > 0 ? results : false;
}
/** End of pagination configuration */
ScaffoldClient.interactiveSetup = function() {
    // functions doesn't requires API

    // display the page title while it is not using the style
    if (!document.querySelector(".cbt-banner") && document.querySelector("h1.page-title")) {
        document.querySelector("h1.page-title").style.display = "block";
    }

    if(document.querySelector(".cbt-home-button a")){
        ScaffoldClient.displayHomeBtn();
    }

    if ("undefined" === typeof tinymce || !tinymce.hasOwnProperty("activeEditor") || !tinymce.activeEditor) {
        if (typeof ScaffoldClient.accordionList === 'function') {
            ScaffoldClient.accordionList();
        }

        if(typeof ScaffoldClient.mutipleAccordion === 'function'){
           ScaffoldClient.mutipleAccordion(); 
        }

        if (typeof ScaffoldClient.tab === 'function') {
            ScaffoldClient.tab();
        }

        // make sure limiter is set before calling apis
        if (typeof Bottleneck != 'undefined' && ScaffoldClient.limiter && ScaffoldClient.getCourseID) {
            ScaffoldClient.apiFunctions();
        } else {
            ScaffoldClient.initBottleneck().then(function () {
                if (ScaffoldClient.getCourseID()) {
                    ScaffoldClient.apiFunctions();
                }
            });
        }
    }
}



ScaffoldClient.apiFunctions = function() {
    //console.log("bottleneck is setup -  starting API calls");
    Promise.all(ScaffoldClient.preloadPromises).then(function () {        
        if(document.getElementById('cbt-progress')){
            ScaffoldClient.getProgressPie().then(function(progressPie){
                ScaffoldClient.createProgressPie(progressPie); // custom based on the template
            });
        }
        if (document.getElementById("cbt-progress-current")) {
            ScaffoldClient.getContinueItem().then(function(item){
                ScaffoldClient.createContinueBlock(item); // custom based on the template
            });
        }
        
        if (document.querySelector(".cbt-module-cards-simple")) {
            ScaffoldClient.setModuleCardsCompletion(ScaffoldClient.courseData.modules); // custom based on the template
        }

        if(document.getElementById('cbt-learner')){
            ScaffoldClient.getUserName().then(function(user){
                if(user && user.hasOwnProperty("short_name")){
                    document.getElementById("cbt-learner").innerHTML ='Welcome ' + user.short_name + ',';
                }
            });
        }   

        if (document.querySelector('.module-sequence-footer')) {
            ScaffoldClient.findNavItems().then(function(navItem){
                let navHTML = ScaffoldClient.getNavHTML(navItem);
                if($(".module-sequence-footer").length > 0) {
                    $(".module-sequence-footer").parent().append(navHTML);
                    $(".module-sequence-footer").hide();
                }
            });
        }
    })

}



        },
        afterOnLoad: () => {
            /* Import Style and Script */
var head = document.getElementsByTagName("head")[0];
var bootstrapStyle = document.createElement("link");
bootstrapStyle.rel = "stylesheet";
bootstrapStyle.type = "text/css";
bootstrapStyle.href = "https://cdn.jsdelivr.net/npm/bootstrap@4.4/dist/css/bootstrap-grid.min.css";
head.insertBefore(bootstrapStyle, head.firstChild);

if (typeof jQuery == 'undefined' || typeof jQuery === undefined || typeof jQuery === null) {
    var headTag = document.getElementsByTagName("head")[0];
    var jqTag = document.createElement('script');
    jqTag.type = 'text/javascript';
    jqTag.src = 'https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js';
    headTag.appendChild(jqTag);
}

if (!/^\/courses\/\d+\/gradebook/.test(window.location.pathname) && !/^\/courses\/\d+\/assignment/.test(window.location.pathname) && !/\/edit$/.test(window.location.pathname)){document.body.classList.remove('full-width');}

// Only start to load the interactivity while the content page is loaded  
if (!document.querySelector(".user_content, #quiz_show")) {
    // mobile - if (document.querySelector('#content'))
    const contentLoadInterval = window.setInterval(function () {
        if (document.querySelector(".user_content, #quiz_show")) {
            // mobile - if (document.querySelector('#content'))
            window.clearInterval(contentLoadInterval);
            ScaffoldClient.interactiveSetup();
        }
    }, 500);
    window.setTimeout(function () {
        window.clearInterval(contentLoadInterval);
    }, 10000);
} else {
    ScaffoldClient.interactiveSetup();
}


        },
        css:[],
        js:[]
    };

    m.data = {};

    m.init = function(options) {
        if (ScaffoldClient.oninitset) return false;
        ScaffoldClient.options = $.extend(ScaffoldClient.options, options );
        if (ScaffoldClient.options.css !== undefined) {
            if (typeof ScaffoldClient.options.css === 'string')
                ScaffoldClient.options.css = [ScaffoldClient.options.css];
            ScaffoldClient.options.css.forEach((a) => {
                var fileref=document.createElement("link")
                fileref.setAttribute("rel", "stylesheet")
                fileref.setAttribute("type", "text/css")
                fileref.setAttribute("href", a)
                document.getElementsByTagName("head")[0].appendChild(fileref)
            });
        }

        if (ScaffoldClient.options.js !== undefined) {
            if (typeof ScaffoldClient.options.js === 'string')
                ScaffoldClient.options.js = [ScaffoldClient.options.js];
                
            ScaffoldClient.options.js.forEach((a) => {
                var st   = document.createElement("script");
                st.type  = "text/javascript";
                st.src   = a;
                document.getElementsByTagName('head')[0].appendChild(st);
            });
        }

        if (ScaffoldClient.modules.length) {
            ScaffoldClient.modules.forEach(item => {
                if (item.init !== undefined && typeof item.init === 'function')
                    item.init();
            });
        }

        if (ScaffoldClient.options.afterInit !== undefined && typeof ScaffoldClient.options.afterInit === 'function')
            ScaffoldClient.options.afterInit();

        ScaffoldClient.oninitset = true;

    };

    m.onPageLoad = function() {
        if (!ScaffoldClient.oninitset || ScaffoldClient.onloadset) {
			if (!ScaffoldClient.loadcheck) {
				ScaffoldClient.loadcheck = setInterval(function() {
					if (document.readyState === 'complete') {
						ScaffoldClient.onPageLoad();
					}
				}, 250);
			}
			
			if (200 == ScaffoldClient.loadcount) {
				clearInterval(ScaffoldClient.loadcheck);
			} else {
				ScaffoldClient.loadcount += 1;
			}
			return;
		}

		if (ScaffoldClient.loadcheck)
			clearInterval(ScaffoldClient.loadcheck);
		
        ScaffoldClient.loadcount = 0;

        if (ScaffoldClient.modules.length) {
            ScaffoldClient.modules.forEach(item => {
                if (item.pageload !== undefined && typeof item.pageload === 'function')
                    item.pageload();
            });
        }

        if (ScaffoldClient.options.afterOnLoad !== undefined && typeof ScaffoldClient.options.afterOnLoad === 'function')
            ScaffoldClient.options.afterOnLoad();
        
        ScaffoldClient.onloadset = true;
    };

    m.getCourseID = function() {
        if (ScaffoldClient.options['courseid'] === undefined) {
            if (window?.ENV?.COURSE_ID) {
                ScaffoldClient.options['courseid'] = window.ENV.COURSE_ID;
            } else {
                if (document.getElementById('cbt-courseid')) {
                    ScaffoldClient.options['courseid'] = document.getElementById('cbt-courseid').getAttribute('data-course-id');
                } else if (document.getElementById('cbt-progress')) {
                    ScaffoldClient.options['courseid'] = document.getElementById('cbt-progress').getAttribute('data-course-id');
                } else if(window.location.pathname.match(/(courses)\/[0-9]{1,}/gi)) {
                    var id = window.location.pathname.match(/(courses)\/[0-9]{1,}/gi)[0].split("courses/");
                    ScaffoldClient.options['courseid'] = id[id.length - 1];
                }
            }
        }
        return ScaffoldClient.options.courseid;
    };

    m.getCsrfToken = function() {
        var csrfRegex = new RegExp('^_csrf_token=(.*)$');
        var csrf;
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
             var cookie = cookies[i].trim();
             var match = csrfRegex.exec(cookie);
             if (match) {
                  csrf = decodeURIComponent(match[1]);
                  break;
             }
        }
        return csrf;
    };

    m.getOrigin = function() {
                console.log("test function 1");

        return ScaffoldClient.options.origin;
    };

	m.getPageTitle = function() {
       
		
		if (ScaffoldClient.options['pagetitle'] !== undefined) return ScaffoldClient.options['pagetitle'];
        var pageTitle = "";
        //get page title
        if (document.getElementsByClassName("page-title") && document.getElementsByClassName("page-title").length > 0 ){
            pageTitle = document.getElementsByClassName("page-title")[0].innerHTML;
        } else if (document.querySelectorAll(".ellipsible") && document.querySelectorAll(".ellipsible").length > 2){
            pageTitle = document.querySelectorAll(".ellipsible")[document.querySelectorAll(".ellipsible").length-1].innerText
        } else if (document.title){
            pageTitle = document.title;
        }

        ScaffoldClient.options['pagetitle'] = pageTitle;
        return ScaffoldClient.options.pagetitle;

	};

    m.merge = function() {
        var dst = {}
            ,src
            ,p
            ,args = [].splice.call(arguments, 0)
        ;
    
        while (args.length > 0) {
            src = args.splice(0, 1)[0];
            if (toString.call(src) == '[object Object]') {
                for (p in src) {
                    if (src.hasOwnProperty(p)) {
                        if (toString.call(src[p]) == '[object Object]') {
                            dst[p] = ScaffoldClient.merge(dst[p] || {}, src[p]);
                        } else {
                            dst[p] = src[p];
                        }
                    }
                }
            }
        }
    
       return dst;
    };

    m.fetchstatus = function(response) {
        if (response.status >= 200 && response.status < 300) {
             return Promise.resolve(response)
        } else {
             return Promise.reject(new Error(response.statusText))
        }
    };

    /*
    * Function which returns json from response
    */
    m.fetchjson = function(response) {
        return response.json()
    };

    
    m.accordionList = function() {
        // Accordion


function accordionToggle(event){
    var code;
    if (event.type === "keypress") {
        code = event.charCode || event.keyCode;
    }
    if (event.type === "click" || code === 32 || code === 13) {
        var parent = event.currentTarget.parentNode;
        if (!parent.classList.contains('active')) {
            event.currentTarget.setAttribute('aria-expanded', 'true');
            event.currentTarget.setAttribute('aria-select', 'true');
            parent.classList.add('active');
            event.currentTarget.querySelector('i.cbt-accordion-close').classList.add('cbt-accordion-open');
            event.currentTarget.querySelector('i.cbt-accordion-close').classList.remove('cbt-accordion-close');

            parent.querySelector('.cbt-accordion-content').classList.toggle('cbt-answer');
            parent.querySelector('.cbt-accordion-content').setAttribute('aria-hidden', 'false');
            //reload iframe when it open
            var iframes = parent.querySelectorAll('iframe');
            if (iframes.length > 0) {
                for (var i = 0; i < iframes.length; i++) {
                    iframes[i].src = iframes[i].src;
                }
            }
        } else {
            parent.querySelector('.cbt-accordion-content').classList.toggle('cbt-answer');
            parent.classList.remove('active');
            event.currentTarget.querySelector('i.cbt-accordion-open').classList.add('cbt-accordion-close');
            event.currentTarget.querySelector('i.cbt-accordion-open').classList.remove('cbt-accordion-open');
            event.currentTarget.setAttribute('aria-expanded', 'false');
            event.currentTarget.setAttribute('aria-select', 'false');
        }
    }
}


const acc = document.querySelectorAll('.cbt-accordion-list .cbt-accordion-header');
var i;
for (i = 0; i < acc.length; i++) {
    var ctrl_name = 'cbt_panel_' + i + '_content';
    var label_name = 'cbt_panel_' + i;
    acc[i].tabIndex = "0";
    acc[i].role = "tab";
    acc[i].id = label_name;
    acc[i].setAttribute('aria-expanded', 'false');
    acc[i].setAttribute('aria-select', 'false');
    acc[i].setAttribute('aria-controls', ctrl_name);

    var parent = acc[i].parentNode;
    parent.role = "tablist"
    if (parent.querySelector('.cbt-accordion-content')) {
        parent.querySelector('.cbt-accordion-content').id = ctrl_name;
        parent.querySelector('.cbt-accordion-content').tabIndex = "0";
        parent.querySelector('.cbt-accordion-content').role = "tabpanel";
        parent.querySelector('.cbt-accordion-content').setAttribute('aria-hidden', 'true');
        parent.querySelector('.cbt-accordion-content').setAttribute('aria-labelledby', label_name);
    }
    if (!acc[i].querySelector('.cbt-accordion-open, .cbt-accordion-close')) {
        if (parent.querySelector('.cbt-accordion-content.cbt-answer')) {
            acc[i].innerHTML += '<i class="cbt-accordion-close"></i>';
            acc[i].parentNode.classList.remove("active");
        } else {
            acc[i].innerHTML += '<i class="cbt-accordion-open"></i>';
            acc[i].parentNode.classList.add("active");
        }
    } else {
        if (parent.querySelector('.cbt-accordion-content.cbt-answer')) {
            acc[i].querySelector("i").classList.remove("cbt-accordion-open");
            acc[i].querySelector("i").classList.add("cbt-accordion-close");
            acc[i].parentNode.classList.remove("active");
        } else {
            acc[i].querySelector("i").classList.remove("cbt-accordion-close");
            acc[i].querySelector("i").classList.add("cbt-accordion-open");
            acc[i].parentNode.classList.add("active");
        }
    }
    acc[i].addEventListener("click", accordionToggle);
    acc[i].addEventListener("keypress", accordionToggle);
};

    };

    m.setModuleCardsCompletion = function(modulesList) {
        if (modulesList) {
    // get valid modules list
    // get completion status of valid modules
    let modulesInfoList = [];//Array of example object - {"id": module_id, "published": true, "hasProgressTracking": true}
    Array.from(modulesList).forEach((module) => {
        let hasProgressTracking = false;
        if (module.hasOwnProperty("items")) {
            //console.log(`module completion status = ` + module.state);
            hasProgressTracking = module.items.some((item) => item ? (item.hasOwnProperty("completion_requirement") ? true : false) : false);
        }
        modulesInfoList.push({ id: module.id, state: module.state, hasProgressTracking: hasProgressTracking, isManual: false });
    });

    // modulesInfoList.forEach((item) => {
    //     console.log("mod info list" + JSON.stringify(item));
    // });
    // https://genutraining.instructure.com/courses/263/modules/752 -- valid
    // https://genutraining.instructure.com/courses/263/modules/items/6133
    // https://genutraining.instructure.com/courses/263/pages/course-overview-sample?module_item_id=6133

    let moduleCardsArray = document.querySelectorAll(".cbt-module-cards-simple");
    Array.from(moduleCardsArray).forEach((moduleCards) => {
        let cards = moduleCards.querySelectorAll(".cbt-module-card");

        let course_id = ScaffoldClient.getCourseID();
        //let correctLinkType = origin + "/courses/" + course_id + "/modules";

        Array.from(cards).forEach((card, i) => {
            let cardLink = card.querySelector(".cbt-overlay a");

            if(i < modulesInfoList.length){
                let iconElement = card.querySelector(".cbt-card-status");
                let currentModuleIndex = i;
                /*if ( correctLinkType === cardLink.href.substring(0, correctLinkType.length) && !isNaN( cardLink.href.substring(correctLinkType.length + 1) ) ) {
                    let correctModuleID = cardLink.href.substring(correctLinkType.length + 1);
                    let currentModuleInfo = modulesInfoList.reduce((acc, curr, index, arr) => {
                        if(!acc.id === correctModuleID){
                            if(curr.id == correctModuleID)
                            return curr;
                        }
                        return acc;
                    }, false);
                    currentModuleIndex = currentModuleInfo ? modulesInfoList.indexOf(currentModuleInfo): i;
                }*/
                //console.log("> " + currentModuleIndex)
                if (modulesInfoList[currentModuleIndex].hasProgressTracking) {
                    iconElement.classList.add("cbt-icon-incomplete");
                    if (modulesInfoList[currentModuleIndex].state === "completed") {
                        iconElement.classList.remove("cbt-icon-incomplete");
                        iconElement.classList.add("cbt-icon-completed");
                    }
                }
                else {
                    iconElement.classList.remove("cbt-icon-completed");
                    iconElement.classList.remove("cbt-icon-incomplete");
                }
            }
        });
    });

}
    };

    m.getProgressPie = async function() {
        /* Circular progress bar */
return new Promise(function (pieRes, pieRej) {
  if(!ScaffoldClient.courseData || !ScaffoldClient.courseData.modules || ScaffoldClient.courseData.modules == 0){
    //console.log('cannot find course Data :(', !ScaffoldClient.courseData, !ScaffoldClient.courseData.modules, ScaffoldClient.courseData.modules == 0);
    let moduleItemUrl = origin + "/api/v1/courses/" + ScaffoldClient.getCourseID() + "/modules?per_page=100&include[]=items";
    ScaffoldClient.preloadPromises.push(ScaffoldClient.fetchResults(moduleItemUrl, ScaffoldClient.courseData.saveModuleItems));
  } else {
    const progressPie = {
      coursePercentage:  "0%",
      moduleCompletedCount:0,
      moduleCount: 0,
      left_deg: 0,
      right_deg: 0,
      right_color:"var(--cbt-progress-incomplete-colour)",
    };

    var completedModules = ScaffoldClient.courseData.modules.filter((m)=> {return m.state === 'completed'})
    if(completedModules) progressPie.moduleCompletedCount = completedModules.length;

    var publishedModules = ScaffoldClient.courseData.modules.filter((m)=> {return (typeof m.published === 'undefined' || m.published === true)})
    if(publishedModules) progressPie.moduleCount = publishedModules.length;

    //circular progress bar
    if(progressPie.moduleCount > 0){
      var percent = Math.round((progressPie.moduleCompletedCount / progressPie.moduleCount) * 100);
      progressPie.coursePercentage = percent + "%";

      progressPie.right_deg = Math.round(90 + 360 * progressPie.moduleCompletedCount / progressPie.moduleCount);
      if (progressPie.right_deg >= 270) {
        progressPie.right_color = "var(--cbt-progress-colour)";
        progressPie.right_deg = 90;
        progressPie.left_deg = Math.round(360 * progressPie.moduleCompletedCount / progressPie.moduleCount - 180);
      }
    }
    pieRes(progressPie);
  }
}).catch(function (e) {
    // Suppress warnings when canceled
    if (!(e instanceof Bottleneck.BottleneckError)) {
        console.log(`getProgressPie Error: ${e}`);
        Promise.reject(e);
    } else {
        console.log(`Error: ${e}`);
        Promise.reject(e);
    }
});
    };

    m.getContinueItem = async function(course_id) {
        return new Promise(function (continueRes, continueRej) {
  /* Circular progress bar */
  if(!ScaffoldClient.courseData || !ScaffoldClient.courseData.modules || ScaffoldClient.courseData.modules == 0){
    //console.log('cannot find course Data :(');
    let moduleItemUrl = origin + "/api/v1/courses/" + ScaffoldClient.getCourseID() + "/modules?per_page=100&include[]=items";
    ScaffoldClient.fetchResults(moduleItemUrl, ScaffoldClient.courseData.saveModuleItems);
  } else {
    var publishedModules = ScaffoldClient.courseData.modules.filter((m)=> {return ( typeof m.published === 'undefined' || m.published === true) && m.state != 'completed'})
    if(publishedModules && publishedModules.length > 0 ) {
      publishedModules.sort(function(a, b) {
          return parseFloat(a.position) - parseFloat(b.position);
      });
      var incompletedModule = publishedModules[0].items;
      var incompletedItem = incompletedModule.find((i) => {return i.completion_requirement && i.completion_requirement.completed === false});
      // console.log(incompletedItem);
      if(incompletedItem){
        incompletedItem['status'] = publishedModules[0].state;
        incompletedItem['module_name'] = publishedModules[0].name;
        incompletedItem['module_item_link'] = ScaffoldClient.getOrigin() + incompletedItem.url.split("/api/v1")[1] + '?module_item_id=' + incompletedItem.id;
        continueRes(incompletedItem);
      } else {
        continueRes(null);
      }
    } else {
      continueRes(null);
    }
  }
}).catch(function (e) {
  // Suppress warnings when canceled
  if (!(e instanceof Bottleneck.BottleneckError)) {
      console.log(`getContinueItem Error: ${e}`);
      Promise.reject(e);
  }
});




    };

    m.tabs = function() {
        // Tab
function tabDisplay(event){
  var code;
  if (event.type === "keypress") {
    code = event.charCode || event.keyCode;
  }
  if (event.type === "click" || code === 32 || code === 13) {
    var t_con = event.currentTarget.closest('.cbt-tabs').getElementsByClassName("cbt-tab-content");
    var tabs = event.currentTarget.closest('.cbt-tabs').getElementsByClassName("cbt-tab-trigger");

    for (i = 0; i < t_con.length; i++) {
      t_con[i].style.display = "none";
      t_con[i].setAttribute('aria-hidden', 'true');
    }

    for (i = 0; i < tabs.length; i++) {
      tabs[i].classList.remove("active");
      tabs[i].setAttribute('aria-expanded', 'false');
    }
    event.currentTarget.setAttribute('aria-expanded', 'true');
    event.currentTarget.closest('.cbt-tabs').querySelector('.cbt-tab-content[data-content='+ event.currentTarget.dataset.content+']').style.display = "block";
    event.currentTarget.closest('.cbt-tabs').querySelector('.cbt-tab-content[data-content='+ event.currentTarget.dataset.content+']').setAttribute('aria-hidden', 'false');
    event.currentTarget.classList.add("active");
  }
}

var i;
var tabs = document.querySelectorAll(".cbt-tabs");
for (let tab of tabs){
    t_con = tab.getElementsByClassName("cbt-tab-content");
    for (i = 1; i < t_con.length; i++) {
        t_con[i].style.display = "none";
    }
}

var triggers = document.getElementsByClassName("cbt-tab-trigger");

for (let trigger of triggers) {
    trigger.tabIndex = "0";
    trigger.role="tab";
    trigger.addEventListener("click", tabDisplay);
    trigger.addEventListener("keypress", tabDisplay);
}

var tab_content = document.getElementsByClassName("cbt-tab-content");

for (let content of tab_content) {
    content.tabIndex = "0";
    content.role="tabpanel";
    var tab_div = content.getElementsByTagName("div");
    for (let container of tab_div) {
        container.tabIndex = "0";
    }
}

    };

    m.returnModuleInfo = async function(pageTitle, course_id) {
        if (course_id === undefined) {
    course_id = ScaffoldClient.getCourseID();
}
return new Promise(function(i , e) {
    fetch(origin + "/api/v1/courses/" + course_id + "/modules?per_page=10000&include[]=items&search_term=" + pageTitle, {
    method: 'GET',
    credentials: 'include',
    headers: {
            "Accept": "application/json",
            "X-CSRF-Token": ScaffoldClient.getCsrfToken()
    }
    })
    .then(ScaffoldClient.fetchstatus)
    .then( ScaffoldClient.fetchjson)
    .then(function(m) {
    var modules = [];
        for( let module of m){
        if (Array.from(module.items).find(item => item.title === pageTitle)) {modules.push(module);}
        }
        /* It is possible the user insert same page in two different modules. We only handle the first one. */
        modules ? i(modules[0]): e(Error("The page is not in any module"));

    }).catch(function(t) {
        e(Error(t))
    })
})
    };

    m.returnModItems = async function(moduleID, course_id) {
        if (course_id === undefined) {
    course_id = ScaffoldClient.getCourseID();
}
return new Promise(function(ic , e, pageNum) {
    var url = ScaffoldClient.getOrigin() + "/api/v1/courses/" + course_id + "/modules/" + moduleID +"/items?per_page=10000";
    if (pageNum !== undefined && pageNum > 1) {
        url += "&page=" + pageNum;
    }
    fetch(url,{
        method: 'GET',
        credentials: 'include',
        headers: {
            "Accept": "application/json",
            "X-CSRF-Token": ScaffoldClient.getCsrfToken()
        }
    }).then(function(response){
        var m = [];
        if (response.status >= 200 && response.status < 300) {
            var resHeader = (response.headers.get("Link")) ? response.headers.get("Link") : '';
            m = response.json();
            var pagination = resHeader.split(',');
            const totalPage = (pagination.length) ? parseInt(pagination[pagination.length-1].split(';')[0].match(/(\?|\&)page=([\d]+)/g)[0].split("=")[1]) : 1;
            if (totalPage != 1) {
                var paginationDetails = {};
                for (let i = 0; i < pagination.length; i++) {
                    var pd = pagination[i].split(';');
                    var key = pd[1].split('=')[1].replace(/[^\w\s]/gi, '');
                    paginationDetails[key] = pd[0];
                }
                if (pagination['current'] !== undefined && pagination['last'] !== undefined && pagination['current'] != pagination['last']) {
                    var results = ScaffoldClient.returnModItems(moduleID, course_id, pagination['current'] + 1);
                    Array.from(results).forEach(function(i, c) {
                        m.push(i)
                    });
                }
            }
        }
        ic(m);
    }).catch(function(t) {
        e(Error(t));
        ic([]);
    })
})
    };

    m.getUserName = function(data) {
        /* return user name */
return new Promise(function (userRes, userRej) {
    let url = `/api/v1/users/self`;
    if(typeof Bottleneck != 'undefined' && ScaffoldClient.limiter && typeof ScaffoldClient.fetchResult === 'function'){
        ScaffoldClient.fetchResult(url, function(data){
            if (typeof data !== 'object' || data.length === 0) {
                userRes(false);
            }
            if (data.hasOwnProperty("short_name")) {
                userRes(data);
            } else {
                console.log('Request failed', error);
                userRej(error);
            }
        });
    } else {
        fetch('/api/v1/users/self', {
            method: 'GET',
            credentials: 'include',
            headers: {
                    "Accept": "application/json",
                    "X-CSRF-Token": ScaffoldClient.getCsrfToken()
            }
        })
        .then(ScaffoldClient.fetchstatus)
        .then( ScaffoldClient.fetchjson)
        .then(function (user) {
            if (user.hasOwnProperty("short_name")) {
                userRes(user)
            }
        }).catch(function(error) {
            console.log('Request failed', error);
            userRej(error);
        });
    }
});


    };

    m.findNavItems = async function() {
        let courseId = ScaffoldClient.getCourseID();
let pageType = '';
let pageId;

if (window.location.search && window.location.search.match(/module_item_id/gi)) {
    pageId = (s = window.location.search.split("module_item_id="))[s.length - 1]
    , pageType = "ModuleItem";
} else if (window.location.pathname.match(/(courses)\/[0-9]{1,}\/(pages)\//gi))
  if (window.location.pathname.match(/new/gi) || window.location.pathname.match(/edit/gi))
      ;
  else {
    pageId = (s = (i = window.location.pathname.match(/(pages)\/.{1,}/gi))[0].split("pages/"))[s.length - 1]
      , pageType = "Page";
  }
else if (window.location.pathname.match(/(courses)\/[0-9]{1,}\/(quizzes)\//gi))
  if (window.location.pathname.match(/new/gi) || window.location.pathname.match(/edit/gi))
      ;
  else {
    pageId = (s = (i = window.location.pathname.match(/(quizzes)\/[0-9]{1,}/gi))[0].split("quizzes/"))[s.length - 1]
      , pageType = "Quiz";
  }
else if (window.location.pathname.match(/(courses)\/[0-9]{1,}\/(assignments)\//gi) && !window.location.pathname.match(/syllabus/gi))
  if (window.location.pathname.match(/new/gi) || window.location.pathname.match(/edit/gi))
      ;
  else {
    pageId = (s = (i = window.location.pathname.match(/(assignments)\/[0-9]{1,}/gi))[0].split("assignments/"))[s.length - 1]
      , pageType = "Assignment";
  }
else if (window.location.pathname.match(/(courses)\/[0-9]{1,}\/(discussion_topics)\//gi))
  if (window.location.pathname.match(/new/gi) || window.location.pathname.match(/edit/gi))
      ;
  else {
    pageId = (s = (i = window.location.pathname.match(/(discussion_topics)\/[0-9]{1,}/gi))[0].split("discussion_topics/"))[s.length - 1]
      , pageType = "Discussion";
  }
else if (window.location.pathname.match(/(courses)\/[0-9]{1,}\/(files)/gi)) {
  pageId = (s = (i = window.location.pathname.match(/(files)\/[0-9]{1,}/gi))[0].split("files/"))[s.length - 1]
    , pageType = "File";
} else if (window.location.pathname.match(/(courses)\/[0-9]{1,}\/(modules\/items)/gi)) {
  var i = window.location.pathname.match(/(modules\/items)\/.{1,}/gi)
    , s = i[0].split("modules/items/");
    pageId = s[s.length - 1];
    pageType = "ModuleItem";
}

return new Promise(function (res, rej) {
    if(courseId && pageType && pageId){
        $.ajax({
        url:  "/api/v1/courses/" + courseId + "/module_item_sequence?asset_type=" + pageType + "&asset_id=" + pageId + "&frame_external_urls=true"
        }).fail(function(navItem) {}).done(function(navItem) {
        if (navItem.items.length > 0 && navItem.items[0].prev){
            var prev = navItem.items[0].prev.module_id;
            for (var i = 0; i < navItem.modules.length; i++){
            if (navItem.modules[i].id == prev) {
                navItem.items[0].prev.module_title = navItem.modules[i].name;
                break;
            }
            }
        }
        if (navItem.items.length > 0 && navItem.items[0].next){
            var next = navItem.items[0].next.module_id;
            for (var i = 0; i < navItem.modules.length; i++){
                if (navItem.modules[i].id == next) {
                navItem.items[0].next.module_title = navItem.modules[i].name;
                break;
                }
            }
        }
        res(navItem);
        })
    } else {
        rej();
    }
}).catch(function (e) {
    // Suppress warnings when canceled
    console.log(`findNavItems Error: ${e}`);
    rej();
});
    };

    m.createProgressPie = function(progressPie) {
        if (typeof progressPie === "object" && Number.isInteger(progressPie.right_deg)) {
    html = '<div class="cbt-progress-pie">\
            <div class="cbt-progress-mask-left" style="transform: rotate(' + progressPie.left_deg + 'deg); ">&nbsp;</div> \
            <div class="cbt-progress-mask-right" style="transform: rotate(' + progressPie.right_deg + "deg); background-color: " + progressPie.right_color + '">&nbsp;</div> \
            <p class="cbt-progress-percentage flexbox">' + progressPie.coursePercentage + '</p> \
            </div> <div class="cbt-progress-status">';

    if (progressPie.moduleCompletedCount === progressPie.moduleCount) {
        html += '<p>Well done! You have completed all the modules.</p></div>';
    } else {
        html += '<p>You have completed ' + progressPie.moduleCompletedCount + " / " + progressPie.moduleCount + " modules.</p></div>";
    }
}
document.getElementById("cbt-progress").innerHTML = html;
    };

    m.createContinueBlock = function(continueItem) {
        if(continueItem && continueItem.status != "completed"){
    var page_title = continueItem.title;
    var module_title = continueItem.module_name;
    if (document.getElementById("cbt-progress-current")) {
        document.getElementById("cbt-progress-current").innerHTML =
        '<a class="cbt-overlay" aria-label="' + page_title + '" href="' + continueItem.module_item_link + '"></a>\
        <div class="cbt-progress-current-container">\
            <div class="cbt-progress-current-info"> \
                <p class="strong">Continue...</p>\
                <p>' + module_title + '</p>\
                <h3>' + page_title + '</h3>\
            </div>\
            <div class="cbt-progress-button-container">\
                <p class="cbt-progress-button"> <i class="cbt-progress-button-icon" aria-hidden="true"></i></p> \
            </div>\
        </div>';
    }
} else {
    if (document.getElementById("cbt-progress-current")) {
        document.getElementById("cbt-progress-current").innerHTML =
        '<div class="cbt-progress-current-container">\
            <div class="cbt-progress-current-info">\
            <p class="strong">Congratulations</p>\
            <p>Well done!</p>\
            <h3>You have completed all the modules</h3>\
        </div></div>';
    }
}

    };

    m.getNavHTML = function(navItem) {
        var doneHtml = "";
if(document.getElementById("mark-as-done-container")){
    doneHtml = document.getElementById("mark-as-done-container").innerHTML;
    document.getElementById("mark-as-done-container").innerHTML = "";
}
var html = '<div class="cbt-nav-footer" role="navigation" aria-label="Module Navigation">';
html += doneHtml,
html += "<hr>",
html += '<div class="row">',
navItem.items.length > 0 && navItem.items[0].prev ? (html += '<div class="col-xs-12 col-sm-12 col-md-6 col-6">',
html += '<div class="cbt-nav-prev"><div class="cbt-nav-wrapper left"> \
        <div class="cbt-nav"><i class="cbt-icon-left" aria-hidden="true"></i></div><span>Back</span></div>\
        <div class="cbt-nav-item-detail right"> \
        <p class="cbt-nav-module-name">'+ navItem.items[0].prev.module_title +'</p> \
        <p class="cbt-nav-item-name">' + navItem.items[0].prev.title + "</p></div>",
html += '<a class="cbt-nav-link" aria-label="' + navItem.items[0].prev.module_title + '" href="' + navItem.items[0].prev.html_url + '"></a>',
html += "</div></div>") : html += '<div class="col-xs-12 col-sm-12 col-md-6 col-6 cbt-inactive"></div>';


navItem.items.length > 0 && navItem.items[0].next ? (html += '<div class="col-xs-12 col-sm-12 col-md-6 col-6">',
html += '<div class="cbt-nav-next"><div class="cbt-nav-item-detail left"><p class="cbt-nav-module-name">'+navItem.items[0].next.module_title+'</p> \
        <p class="cbt-nav-item-name">' + navItem.items[0].next.title + '</p></div> \
        <div class="cbt-nav-wrapper right"><div class="cbt-nav"><i class="cbt-icon-right" aria-hidden="true"></i></div><span>Next</span></div>',
html += '<a class="cbt-nav-link" aria-label="' + navItem.items[0].next.title + '" href="' + navItem.items[0].next.html_url + '"></a>',
html += "</div></div>") : html += '<div class="col-xs-12 col-sm-12 col-md-6 col-6 cbt-inactive"></div>',
html += "</div>",
html += "</div>";

return html

    };
    
	return m;

})(ScaffoldClient || {}, jQuery);var ScaffoldBuilder = (function (m, $) {
	m.editor;

	m.modules = {'carousel_1': {"id":"carousel_1","title":"Accordion","tmpl":"<div class=\"scaffold-media-box cbt-content\" data-context-menu=\"delete\" editable=\"false\" data-caninsertinto=\"false\">\n    <div class=\"cbt-accordion-list\">\n        <div class=\"cbt-accordion-header\" editable=\"true\" data-caninsertinto=\"false\">\n            <h2>Accordion header</h2>\n        </div>\n        <div class=\"cbt-answer cbt-accordion-content\" data-context-menu=\"remove\" editable=\"true\" data-canhavechild=\"true\">\n            <h3>Subheading</h3>\n            <p>Accordion content</p>\n        </div>\n    </div>\n</div>","menu":[]},
		'basic_activity_header_328': {"id":"basic_activity_header_328","title":"Sample Activity Header","tmpl":"<div class=\"scaffold-media-box cbt-activity-box cbt-content\" data-context-menu=\"delete moveup movedown duplicate insertbefore insertafter insert\" editable=\"false\" caninsert=\"false\" data-canhavechild=\"true\">\n    <span class=\"content-selector\" aria-hidden=\"true\">&nbsp;</span>\n    <div class=\"cbt-activity-heading\" data-context-menu=\"insertafter delete\">\n        <h2><i class=\"cbt-icon-apply\" aria-hidden=\"true\"></i>Activity</h2>\n    </div>\n    <div class=\"cbt-activity-content\" data-canhavechild=\"true\" data-context-menu=\"insert delete insertafter insertbefore duplicate\">\n        <p>Activity content</p>\n    </div>\n\n</div>","menu":[]},
		'basic_footer_324': {"id":"basic_footer_324","title":"Footer","tmpl":"<div class=\"scaffold-media-box cbt-footer-container\" data-context-menu=\"insert delete\" editable=\"false\" caninsert=\"false\">\n    <footer class=\"cbt-footer-content\">\n        <h2>Need assistance?</h2>\n        <div class=\"cbt-footer-info\">\n            <p>Contact us</p>\n            <p>example@example.com</p>\n            <p>+61 0000 0000 000</p>\n        </div>\n    </footer>\n    <div class=\"cbt-footer-logo\">\n        <img src=\"https://placehold.co/300x300\" alt=\"site logo\">\n    </div>\n</div>","menu":[]},
		'basic_module_cards_326': {"id":"basic_module_cards_326","title":"Module cards","tmpl":"<div class=\"scaffold-media-box selected cbt-module-cards-container\" data-context-menu=\"delete moveup movedown insertbefore insertafter insert\">\n    <span class=\"content-selector\" aria-hidden=\"true\">&nbsp;</span>\n    <hr/>\n    <h2>Modules</h2>\n    <div class=\"cbt-module-cards-simple\" data-context-menu=\"genu_module_card\">\n        <div class=\"cbt-module-card\" data-context-menu=\"delete moveup movedown add-module-card hide-module-card\">\n            <div class=\"cbt-overlay\"><a href=\"#\"><span>Insert link</span></a></div>\n            <div class=\"cbt-module-image\" data-context-menu=\"rce-img\"><i class=\"cbt-card-status\"></i><img src=\"https://i.stack.imgur.com/y9DpT.jpg\" width=\"750\" height=\"475\" /></div>\n            <div class=\"cbt-module-info\">\n                <h3>Module 1</h3>\n                <p aria-label=\"title\">Module title</p>\n            </div>\n            <div class=\"cbt-module-footer\">\n                <p aria-label=\"duration\"><i class=\"cbt-icon-clock\"> </i> 40mins</p>\n            </div>\n        </div>\n    </div>\n    <hr/>\n</div>","menu":[]},
		'callout_box_10': {"id":"callout_box_10","title":"Callout box","tmpl":"<div class=\"scaffold-media-box cbt-content\" data-context-menu=\"insert delete\" editable=\"false\" caninsert=\"false\" data-canhavechild=\"true\">\n    <div class=\"cbt-callout-box\" >\n        <p>Content</p>\n    </div>\n</div>","menu":[]},
		'image_12': {"id":"image_12","title":"Image*","tmpl":"<div class=\"cbt-img\" data-context-menu=\" rce-img\" data-caninsertinto=\"true\">\n    <img src=\"https://i.stack.imgur.com/y9DpT.jpg\" width=\"750\" height=\"475\" />\n    <p><strong>Caption:</strong> Insert caption</p>\n</div>","menu":[]},
		'page_banner_8': {"id":"page_banner_8","title":"Page Banner","tmpl":"<div class=\"scaffold-media-box cbt-banner\" data-context-menu=\"insert delete\" editable=\"false\" caninsert=\"false\">\n    <div class=\"cbt-banner-header flexbox v\">\n        <div>\n            <h1>&nbsp;</h1>\n        </div>\n    </div>\n</div>","menu":[]},
		'page_banner_w_image_96': {"id":"page_banner_w_image_96","title":"Image Page Banner","tmpl":"<div class=\"scaffold-media-box cbt-banner cbt-image-banner\" data-context-menu=\"insert delete\" editable=\"false\" caninsert=\"false\">\n    <div class=\"cbt-banner-header flexbox v\" id = \"cbt-banner-header\">\n        <div>\n            <h1>&nbsp;</h1>\n        </div>\n    </div>\n\n    <div class=\"cbt-banner-image\" data-context-menu=\"rce-img\">\n        <img src=\"https://i.stack.imgur.com/y9DpT.jpg\" width=\"750\" height=\"475\" />\n    </div>\n</div>","menu":[]},
		'paragraph_3': {"id":"paragraph_3","title":"Paragraph*","tmpl":"<div class=\"scaffold-media-box cbt-content\" data-context-menu=\"insert delete\" editable=\"false\" data-caninsertinto=\"true\" data-canhavechild=\"true\">\n    <p>Text</p>\n</div>","menu":[]},
		'banner_progress_pie_9': {"id":"banner_progress_pie_9","title":"Progress Pie and Continue","tmpl":"<div class=\"scaffold-media-box cbt-content\" data-context-menu=\"insert delete\" editable=\"false\" caninsert=\"false\">\n    <div class=\"cbt-progress row\">\n        <div class=\"col-lg-6 col-md-6 col-sm-12\">\n            <div class=\"cbt-progress-container\">\n                <div id=\"cbt-progress\" class=\"cbt-progress-bar\">&nbsp;</div>\n            </div>\n        </div>\n        <div class=\"col-lg-6 col-md-6 col-sm-12\">\n            <div id=\"cbt-progress-current\">\n                <div class=\"cbt-progress-current-container\">\n                    <div class=\"cbt-progress-current-info\">\n                        <p>Please enroll as a student to see your progress.</p>\n                    </div>\n                    <div class=\"cbt-progress-button-container\">\n                        <a class=\"cbt-progress-button\">Start <i class=\"cbt-progress-button-icon\" aria-hidden=\"true\"></i></a>\n                    </div>\n                </div>\n            </div>\n        </div>\n\n    </div>\n</div>","menu":[],"beforeadd":function(e, m) {
                    return (ScaffoldBuilder.editor.dom.get('cbt-module-progress-pie')) ? false : true;
                }},
		'tabs_24': {"id":"tabs_24","title":"Tab x 4","tmpl":"<div class=\"scaffold-media-box cbt-content\" data-context-menu=\"insert delete\" editable=\"false\" caninsert=\"false\">\n    <div class=\"cbt-tabs\">\n        <ul class=\"cbt-tab-trigger-list\">\n            <li class=\"cbt-tab-trigger active\" id=\"tab-1\" role=\"tab\" aria-expanded=\"true\" aria-controls=\"tab-content-1\" data-content=\"tab-content-1\">Tab 1</li>\n            <li id=\"tab-2\" class=\"cbt-tab-trigger\" data-content=\"tab-content-2\" aria-expanded=\"false\" aria-controls=\"tab-content-2\">Tab 2</li>\n            <li id=\"tab-3\" class=\"cbt-tab-trigger\" data-content=\"tab-content-3\" aria-expanded=\"false\" aria-controls=\"tab-content-3\">Tab 3</li>\n            <li id=\"tab-4\" class=\"cbt-tab-trigger\" data-content=\"tab-content-4\" aria-expanded=\"false\" aria-controls=\"tab-content-4\">Tab 4</li>\n        </ul>\n        <div class=\"cbt-tab-content\" role=\"tabpanel\" data-content=\"tab-content-1\" aria-hidden=\"false\" aria-labelledby=\"tab-1\" data-context-menu=\"remove\" data-canhavechild=\"true\">\n            <p>Tab 1 Lorem ipsum dolor sit amet, consectetur adipiscing elit. </p>\n        </div>\n        <div class=\"cbt-tab-content\" role=\"tabpanel\" data-content=\"tab-content-2\" aria-hidden=\"true\" aria-labelledby=\"tab-2\" data-context-menu=\"remove\" data-canhavechild=\"true\">\n            <p>Tab 2 Lorem ipsum dolor sit amet, consectetur adipiscing elit. </p>\n        </div>\n        <div class=\"cbt-tab-content\" role=\"tabpanel\" data-content=\"tab-content-3\" aria-hidden=\"true\" aria-labelledby=\"tab-3\" data-context-menu=\"remove\" data-canhavechild=\"true\">\n            <p>Tab 3 Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>\n        </div>\n        <div class=\"cbt-tab-content\" role=\"tabpanel\" data-content=\"tab-content-4\" aria-hidden=\"true\" aria-labelledby=\"tab-4\" data-context-menu=\"remove\" data-canhavechild=\"true\">\n            <p>Tab 4 Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>\n        </div>\n    </div>\n</div>","menu":[]},
		'video_activities_11': {"id":"video_activities_11","title":"Video*","tmpl":"<div class=\"scaffold-media-box cbt-content\" data-context-menu=\"insert delete\" editable=\"false\" caninsert=\"false\">\n        <span class=\"content-selector\">&nbsp;</span>         \n        <div class=\"cbt-video\">\n            <div class=\"cbt-video-container\" data-context-menu=\"insert delete remove rce-embed\"><span class=\"content-selector\">&nbsp;</span> \n                <iframe title=\"YouTube video player\" src=\"https://www.youtube.com/embed/NpEaa2P7qZI\" width=\"560\" height=\"315\" allowfullscreen=\"allowfullscreen\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\"></iframe>\n            </div>\n            <p class=\"cbt-button\">\n                <a href=\"#\">Download transcript</a>\n            </p>\n    </div>\n</div>\n","menu":[]}};
        m.componentmenu = [{"name":"General Components","items":["page_banner_8","paragraph_3","image_12","video_activities_11","callout_box_10","basic_activity_header_328"]},{"name":"Homepage","items":["banner_progress_pie_9","page_banner_w_image_96","basic_footer_324","basic_module_cards_326"]},{"name":"Interactive","items":["carousel_1","tabs_24"]}];
	m.oninitset = false;

	m.onloadset = false;
	m.loadcheck = false;
	m.loadcount = 0;
	m.enablefavourites = true;

	m.haspastedoptions = false;

	m.loadeditorcss = true;

	m.options = {
		source: 'api',
		editorposition: 1,
		enabled: true,
		origin: document.location.origin,
                afterInit: () => { 

ScaffoldBuilder.context.menuItem['add-module-card']= {
    id:"genu_module_card",
    label:"Add Module Card",
    icon: "icon-add",
    icon_bg: "",
    clickAction: function(e) {
        let elem = ' <div class="cbt-module-card" data-context-menu="delete moveup movedown add-module-card hide-module-card"> \
        <div class="cbt-overlay"><a href="#"><span>Insert link</span></a></div> \
        <div class="cbt-module-image" data-context-menu="rce-img"><i class="cbt-card-status"></i><img src="https://i.stack.imgur.com/y9DpT.jpg" width="750" height="475" /></div> \
        <div class="cbt-module-info"> \
            <h3>Module #</h3> \
            <p aria-label="title">Module title</p> \
        </div> \
        <div class="cbt-module-footer"> \
            <p aria-label="duration"><i class="cbt-icon-clock" aria-hidden="true"> </i> 40mins</p> \
        </div> \
</div>';
        $(elem).insertAfter(e.data.id);
    }
}

ScaffoldBuilder.context.menuItem['hide-module-card']= {
    id:"genu_hide_module_card",
    label:"Hide",
    icon: "icon-eye",
    icon_bg: "",
    getLabel: function(e) {
        return this.label;
    },
    clickAction: function(e) {
        e.data.id.dataset.contextMenu = e.data.id.dataset.contextMenu.replace('hide-module-card', 'show-module-card');
        e.data.id.classList.add("hide");
    }
}
ScaffoldBuilder.context.menuItem['show-module-card']= {
    id:"genu_show_module_card",
    label:"Show",
    icon: "icon-eye",
    icon_bg: "",
    getLabel: function(e) {
        return this.label;
    },
    clickAction: function(e) {
        e.data.id.dataset.contextMenu = e.data.id.dataset.contextMenu.replace('show-module-card', 'hide-module-card');
        e.data.id.classList.remove("hide");
    }
} },
		defaultactions: ['delete', 'moveup', 'movedown', 'duplicate', 'insertbefore', 'insertafter'],
		editorcss:["https://app.getscaffold.co/assets/css/rtestyles.css"]
	};

	m.settings = {
		name: "scaffoldthemeeditor",
		favourites: []
	};

	m.checkInitOk = function() {
		if (
    ((document.location.pathname.toLowerCase().indexOf("/pages") >= 0 && document.location.pathname.toLowerCase().indexOf("/edit") >= 0) && (
        (ENV.WIKI_RIGHTS !== undefined && (ENV.WIKI_RIGHTS?.update || ENV.WIKI_RIGHTS?.create_page))
    ))
    || ((document.location.pathname.toLowerCase().indexOf("/quizzes") >= 0 || document.location.pathname.toLowerCase().indexOf("/assignments") >= 0 || document.location.pathname.toLowerCase().indexOf("/discussion_topics") >= 0) && ( 
        (document.location.pathname.toLowerCase().indexOf("/edit") >= 0 ) || (document.location.pathname.toLowerCase().indexOf("/new") >= 0 )
    ))
) return true;

window.addEventListener('load', function() {
if ((document.location.pathname.toLowerCase().indexOf("/syllabus") >= 0 ) && $('a.edit_syllabus_link').length ) {
    $(document).on("click keypress", 'a.edit_syllabus_link', function (e) {
        ScaffoldBuilder.reset();
        ScaffoldBuilder.init();
        ScaffoldBuilder.options.editorposition = 2;
        ScaffoldBuilder.onPageLoad();
    });
}
if ( (document.location.pathname.toLowerCase().indexOf("/pages") >= 0 )) {
    $(document).on("click keypress", '.new_page[role="button"]', function (e) {
        ScaffoldBuilder.reset();
        ScaffoldBuilder.init();
        ScaffoldBuilder.options.editorposition = 2;
        ScaffoldBuilder.onPageLoad();
    });
}
});
return false;
		return false;
	};

	m.init = function(options) {

		ScaffoldBuilder.options = $.extend(ScaffoldBuilder.options, options );

		ScaffoldBuilder.getCustomSetting().then(function(e) {
			ScaffoldBuilder.settings = e;
			ScaffoldBuilder.initEditor();
		}, function(e) {
			ScaffoldBuilder.putCustomSetting(ScaffoldBuilder.settings).then(function(e) {
				ScaffoldBuilder.initEditor();
			}, function(e) {
				ScaffoldBuilder.enablefavourites = false;
				ScaffoldBuilder.initEditor();
			})
		});
	};

	m.reset = function() {
		ScaffoldBuilder.oninitset = false;
		ScaffoldBuilder.onloadset = false;
		ScaffoldBuilder.loadcheck = false;
		ScaffoldBuilder.loadcount = 0;
		if ($('.scaffold-element-insert').length) {
			$('.scaffold-element-insert').empty().remove();
		} else {
			if ($('.template-link-wrapper').length) {
				$('.template-link-wrapper').empty().remove();
			} 
			if ($('.scaffold-dock').length) {
				$('.scaffold-dock').empty().remove();
			} 
			if ($('#right-side-wrapper').length && $('#right-side-wrapper').hasClass('with-scaffold')) {
				$('#right-side-wrapper').removeClass('with-scaffold').removeClass('closed');
			}
		}
	};

	m.initEditor = function() {
		if (ScaffoldBuilder.oninitset) return;

		ScaffoldBuilder.getActiveEditor().then(function(e) {
			var config = ScaffoldBuilder.editor.tinymceInitOptions;
			// Load all provided css files into the editor
			var a = "";
			$("link").each(function() {
				($(this).attr("href").match(/(instructure-uploads).{1,}(.css)$/gi) || $(this).attr("href").match(/(brandable_css).{1,}(common).{1,}(.css)$/gi) || $(this).attr("href").match(/(f208ea2fee51cac4437ba3923b5c42521d0de202ff0ec085a619533c6a6651dc).{1,}(.css)$/gi)) && "stylesheet" == $(this).attr("rel") && (a += $(this).attr("href") + ",")
			}), a = a.slice(0, -1), ScaffoldBuilder.editor.dom.loadCSS(a);

			// the theme could provide a custom CSS, which will be accessed via an external URL
			if (ScaffoldBuilder.options.editorcss !== undefined) {
				if (typeof ScaffoldBuilder.options.editorcss === 'string')
					ScaffoldBuilder.options.editorcss = [ScaffoldBuilder.options.editorcss];
				
				ScaffoldBuilder.options.editorcss.forEach((a) => { 
					if (a.match(/(f208ea2fee51cac4437ba3923b5c42521d0de202ff0ec085a619533c6a6651dc).{1,}(.css)$/gi) && a.toLowerCase().indexOf("editor.css") >= 0 && !ScaffoldBuilder.loadeditorcss) return;

					ScaffoldBuilder.editor.dom.loadCSS(a);
				});
			}

			// When click is triggered in editor, display menu
			ScaffoldBuilder.editor.on("click", function(event) {

				if (!ScaffoldBuilder.options.enabled) return false;
				ScaffoldBuilder.displayLastModule();
				var node = ScaffoldBuilder.editor.selection.getNode();
				ScaffoldBuilder.displayContextMenu(node);
			});

			// When keys are pressed in editor, display menu
			ScaffoldBuilder.editor.on("keyup", function(event) {
				var key = event.which || event.keyCode || event.charCode;
				if (8 == key || 46 == key || 13 == key || 37 == key || 38 == key || 39 == key || 40 == key) {

					if (!ScaffoldBuilder.options.enabled) return false;
					ScaffoldBuilder.displayLastModule();
					var node = ScaffoldBuilder.editor.selection.getNode();
					ScaffoldBuilder.displayContextMenu(node);
				}
			});
			ScaffoldBuilder.hoverIndicator();
			ScaffoldBuilder.getComponents();
		});
		if (ScaffoldBuilder.options.afterInit !== undefined)
			ScaffoldBuilder.options.afterInit();

		ScaffoldBuilder.oninitset = true;
	};

	m.onPageLoad = function() {

		if (!ScaffoldBuilder.oninitset || ScaffoldBuilder.onloadset) {
			if (!ScaffoldBuilder.loadcheck) {
				ScaffoldBuilder.loadcheck = setInterval(function() {
					if (document.readyState === 'complete') {
						ScaffoldBuilder.onPageLoad();
					}
				}, 250);
			}
			
			if (200 == ScaffoldBuilder.loadcount) {
				clearInterval(ScaffoldBuilder.loadcheck);
			} else {
				ScaffoldBuilder.loadcount += 1;
			}
			return;
		}

		if (ScaffoldBuilder.loadcheck)
			clearInterval(ScaffoldBuilder.loadcheck);
		
		ScaffoldBuilder.loadcount = 0;

		// Display menu
		$(document).on('click', '.template-link-wrapper .template-link', function(e) {
			e.preventDefault();
			e.stopPropagation();
			if (!ScaffoldBuilder.options.enabled) return false;
			if ($('.template-link-wrapper .element-wrapper').is(':visible'))
				$('.template-link-wrapper .element-wrapper').data({ 'before': null, 'after' : null }); // reset the before and after
			
			if (ScaffoldBuilder.options.editorposition === 1) {
				$('.template-link-wrapper .element-wrapper').toggle();
			} else {
				if ($('.template-link-wrapper .element-wrapper').is(':visible')) {
					$('.template-link-wrapper .element-wrapper').hide();
					$('#right-side-wrapper.with-scaffold').addClass('closed');
					$('#scaffold-dock').addClass('closed');
				} else {
					$('.template-link-wrapper .element-wrapper').show();
					$('#right-side-wrapper.with-scaffold').removeClass('closed');
					$('#scaffold-dock').removeClass('closed');
				}
			}
		});

		$(document).on('click', '.template-link-wrapper a.disable-template-link', function(e) {
			e.preventDefault();
			e.stopPropagation();
			ScaffoldBuilder.toggleScaffold();
		});

		// When menu item is clicked, insert into editor
		$(document).on('click', '.template-link-wrapper .element-item button.element-action', function(e) {
			e.preventDefault();
			e.stopPropagation();
			if (!ScaffoldBuilder.options.enabled) return false;
			var elm = $(this).parent();

			if (elm.data('element-id') && Object.keys(ScaffoldBuilder.modules).length && ScaffoldBuilder.modules[ elm.data('element-id') ] !== undefined) {
				ScaffoldBuilder.insertElement(elm.data('element-id'), false, false, e);
			} else {
				if (elm.data('url')) {
					$.ajax({
						url: elm.data('url')
					}).then(function(result) {
						ScaffoldBuilder.insertElement(result.body, result.url, result.title, e);
					});
				}
				if (elm.data('element')) {
					ScaffoldBuilder.insertElement(elm.data('element'), false, false, e);
				}
			}
			
			if (ScaffoldBuilder.options.editorposition === 1) {
				$('.template-link-wrapper .element-wrapper').toggle();
			} else {
				if ($('.template-link-wrapper .element-wrapper').is(':visible')) {
					$('.template-link-wrapper .element-wrapper').hide();
					$('#right-side-wrapper.with-scaffold').addClass('closed');
					$('#scaffold-dock').addClass('closed');
				} else {
					$('.template-link-wrapper .element-wrapper').show();
					$('#right-side-wrapper.with-scaffold').removeClass('closed');
					$('#scaffold-dock').removeClass('closed');
				}
			}
		});

		$(document).on('keypress', '.template-link-wrapper .element-item button.element-action', function(e) {
			var code;
			code = e.charCode || e.keyCode;

			if (code !== 32 && code !== 13) return;

			e.preventDefault();
			e.stopPropagation();

			if (!ScaffoldBuilder.options.enabled) return false;

			var elm = $(this).parent();

			if (elm.data('element-id') && Object.keys(ScaffoldBuilder.modules).length && ScaffoldBuilder.modules[ elm.data('element-id') ] !== undefined) {
				ScaffoldBuilder.insertElement(elm.data('element-id'), false, false, e);
			} else {
				if (elm.data('url')) {
					$.ajax({
						url: elm.data('url')
					}).then(function(result) {
						ScaffoldBuilder.insertElement(result.body, result.url, result.title, e);
					});
				}
				if (elm.data('element')) {
					ScaffoldBuilder.insertElement(elm.data('element'), false, false, e);
				}
			}
			
			if (ScaffoldBuilder.options.editorposition === 1) {
				$('.template-link-wrapper .element-wrapper').toggle();
			} else {
				if ($('.template-link-wrapper .element-wrapper').is(':visible')) {
					$('.template-link-wrapper .element-wrapper').hide();
					$('#right-side-wrapper.with-scaffold').addClass('closed');
					$('#scaffold-dock').addClass('closed');
				} else {
					$('.template-link-wrapper .element-wrapper').show();
					$('#right-side-wrapper.with-scaffold').removeClass('closed');
					$('#scaffold-dock').removeClass('closed');
				}
			}
		});

		$(document).on('click', '.template-link-wrapper .element-item span.favourite i', function(e) {
			
			e.preventDefault();
			e.stopPropagation();

			if (!ScaffoldBuilder.options.enabled) return false;

			var elm = $(this).closest('.element-item');
			if ($(this).hasClass('yellow')) {
				$(this).removeClass('yellow');
				ScaffoldBuilder.deleteFavourite({element_id: elm.data('element-id') });
			} else {
				if (elm.data('element-id')) {
					$(this).addClass('yellow');
					var payload = { element_id: elm.data('element-id'), category: elm.data('category'), name: $('span.name', elm).text() };
					if (elm.data('element')) {
						payload['element'] = elm.data('element');
					} else {
						payload['url'] = elm.data('url');
					}
					ScaffoldBuilder.addFavourite(payload);
				}
			}
		});

		$(document).on('keypress', '.template-link-wrapper .element-item span.favourite i', function(e) {
			var code;
			code = e.charCode || e.keyCode;

			if (code !== 32 && code !== 13) return;

			e.preventDefault();
			e.stopPropagation();

			if (!ScaffoldBuilder.options.enabled) return false;

			var elm = $(this).closest('.element-item');
			if ($(this).hasClass('yellow')) {
				$(this).removeClass('yellow');
				ScaffoldBuilder.deleteFavourite({element_id: elm.data('element-id') });
			} else {
				if (elm.data('element-id')) {
					$(this).addClass('yellow');
					var payload = { element_id: elm.data('element-id'), category: elm.data('category'), name: $('span.name', elm).text() };
					if (elm.data('element')) {
						payload['element'] = elm.data('element');
					} else {
						payload['url'] = elm.data('url');
					}
					ScaffoldBuilder.addFavourite(payload);
				}
			}
		});
		if ( (document.location.pathname.toLowerCase().indexOf("/pages") >= 0 )) {
			$(document).on("click keypress", '.page-edit__action_buttons .btn.cancel', function (e) {
				ScaffoldBuilder.reset();
			});
		}
		if (ScaffoldBuilder.options.afterOnLoad !== undefined)
			ScaffoldBuilder.options.afterOnLoad();
		
		ScaffoldBuilder.onloadset = true;
	};

	m.getActiveEditor = function() {
		return new Promise(function(resolve, reject) {
			// Apply CSS to editor
			var counter = 0;
			var timeout = setInterval(function() {
				if ("undefined" != typeof tinymce && tinymce.hasOwnProperty("activeEditor") && tinymce.activeEditor) {
					((ScaffoldBuilder.editor = tinymce.activeEditor),
					resolve(!0),
					clearInterval(timeout));
				} else {
					if (200 == counter) {
						(reject(!1), clearInterval(timeout))
					} else {
						counter += 1;
					}
				}
			}, 250);
		});
	};

	m.context = {
		rect: {
			pointer: 18,
			pointer_position_class: '',
		},
		menuItem: {
			delete: {
				icon: "icon-trash",
				label: "Delete",
				id: "delete",
				clickAction: function(e) {
					$(e.data.id).remove();
				}
			},
			moveup: {
				icon: "icon-arrow-up",
				label: "Move Up",
				id: "moveup",
				condition: function(e) {
					return e.previousSibling !== null;
				},
				clickAction: function(e) {
					$(e.data.id).insertBefore($(e.data.id).prev());
				}
			},
			movedown: {
				icon: "icon-arrow-down",
				label: "Move Down",
				id: "movedown",
				condition: function(e) {
					return e.nextSibling !== null;
				},
				clickAction: function(e) {
					$(e.data.id).insertAfter($(e.data.id).next());
				}
			},
			pastebefore: {
				icon: "icon-paste",
				label: "Paste before",
				condition: function() {
					return (ScaffoldBuilder.haspastedoptions) ? true : false;
				},
				id: "pastebefore",
				clickAction: function(e) {
					if (ScaffoldBuilder.haspastedoptions) {
						console.log(e.data.id.id);
						if (e.currentTarget.innerText.includes("Paste before") && $( e.data.id ).length) {
							var pasteTarget = document.createElement("textarea");
							pasteTarget.style.display = 'none';
							pasteTarget.style.position = 'absolute';
							var actElem = $( e.data.id )[0].appendChild(pasteTarget).parentNode;
							pasteTarget.focus();
							document.execCommand("Paste", null, null);
							var paste = pasteTarget.innerText;
							console.log(paste);
							actElem.removeChild(pasteTarget);
							$(paste).insertAfter( $(e.data.id) );
							ScaffoldBuilder.haspastedoptions = false;
						}
					}
				}
			},
			pasteafter: {
				icon: "icon-paste",
				label: "Paste after",
				id: "pasteafter",
				condition: function() {
					return (ScaffoldBuilder.haspastedoptions) ? true : false;
				},
				clickAction: function(e) {
					if (ScaffoldBuilder.haspastedoptions) {
						if (e.currentTarget.innerText.includes("Paste after")) {
							const el = document.createElement("textarea");
							document.body.appendChild(el);
							el.select();
							document.execCommand("paste");
							var html = el.textContent;
							document.body.removeChild(el);
							$(html).insertAfter( $(e.data.id) );
						}
					}
				}
			},
			insertbefore: {
				icon: "icon-add",
				label: "Insert before",
				id: "insertbefore",
				clickAction: function(e) {
					if (e.currentTarget.innerText.includes("Insert before")) {
						$('.element-wrapper').data({ 'before': e.data.id, 'after' : null }); // reset the before and after

						if (ScaffoldBuilder.options.editorposition === 1) {
							if (!$('.element-wrapper').is(':visible'))
								$('.element-wrapper').toggle();
						} else {
							if (!$('.element-wrapper').is(':visible')) {
								$('.template-link-wrapper .element-wrapper').show();
								$('#right-side-wrapper.with-scaffold').removeClass('closed');
								$('#scaffold-dock').removeClass('closed');
							}
						}
					}
				}
			},
			insertafter: {
				icon: "icon-add",
				label: "Insert after",
				id: "insertafter",
				clickAction: function(e) {
					if (e.currentTarget.innerText.includes("Insert after")){
						$('.element-wrapper').data({ 'before': null, 'after' : e.data.id }); // reset the before and after
						if (ScaffoldBuilder.options.editorposition === 1) {
							if (!$('.element-wrapper').is(':visible'))
								$('.element-wrapper').toggle();
						} else {
							if (!$('.element-wrapper').is(':visible')) {
								$('.template-link-wrapper .element-wrapper').show();
								$('#right-side-wrapper.with-scaffold').removeClass('closed');
								$('#scaffold-dock').removeClass('closed');
							}
						}
					}
				}
			},
			remove: {
				icon: "icon-clear-text-formatting",
				label: "Remove content",
				id: "remove",
				clickAction: function(e) {
					e.data.id.innerHTML = '<p><br data-mce-bogus="1"></p>';
				}
			},
			copy: {
				icon: "icon-copy",
				label: "Copy",
				id: "copy",
				clickAction: function(e) {
					var copyText = e.data.id.innerHTML;
					navigator.clipboard.writeText(copyText).then(function() {
						ScaffoldBuilder.haspastedoptions = true;
					  }, function() {
						/* clipboard write failed */
					  });
					
				}
			},
			convert: {
				icon: "icon-materials-required",
				label: "Convert to Scaffold Component",
				id: "convert",
				clickAction: function(e) {
					ScaffoldBuilder.destroyContextMenu();
					ScaffoldBuilder.showModal('Convert to Scaffold Component', '<p>You are about to convert this element to a Scaffold component. This will allow you acccess to the default actions available such as deleting, moving up or down, etc.</p><p>Are you sure you want to proceed?</p>', 'Continue', function(id) { 
						ScaffoldBuilder.convertToScaffold(id, ScaffoldBuilder.options.defaultactions);
					}, e.data.id.id );
				}
			},
			duplicate: {
				icon: "icon-copy",
				label: "Duplicate",
				id: "duplicate",
				clickAction: function(e) {
					var copyText = e.data.id.outerHTML;
					var element = $('<div></div>').html(copyText);
					var uniqueId = ScaffoldBuilder.createUniqueId();
					element.children(":first").attr({"id": uniqueId});
					$('.scaffold-media-box', element).insertAfter( $( e.data.id ) );
				}
			},
			'rce-arc': {
				icon: "mce-ico mce-i-none",
				icon_bg: "https://files.instructuremedia.com/logos/studio-logo-squid-tiny-electric.svg",
				label: "Studio",
				id: "rce-arc",
				clickAction: function(e) {
					ScaffoldBuilder.openStudio();
				}
			},
			'rce-img': {
				icon: "icon-image",
				label: "Image",
				id: "rce-img",
				clickAction: function(e) {
					ScaffoldBuilder.openImages(e.data.id)
				}
			},
			'rce-youtube': {
				icon: "mce-ico mce-i-none",
				icon_bg: "https://www.edu-apps.org/assets/lti_public_resources/youtube_icon.png",
				label: "YouTube",
				id: "rce-youtube",
				clickAction: function(e) {
					ScaffoldBuilder.openYoutube();
					ScaffoldBuilder.selectVideo(e.data.id);
				}
			},
			'rce-link': {
				icon: "icon-link",
				label: "Link to URL",
				id: "rce-link",
				clickAction: function(e) {
					ScaffoldBuilder.openLinks()
				}
			},
			'rce-embed': {
				icon: "icon-attach-media",
				label: "Insert media",
				id: "rce-embed",
				clickAction: function(e) {
					ScaffoldBuilder.openEmbed();
					ScaffoldBuilder.selectVideo(e.data.id);
				}
			},
			'rce-h5p': {
				icon: "mce-ico mce-i-none",
				icon_bg: "https://rmitonline.h5p.com/img/h5p-icon.png",
				label: "H5P",
				id: "rce-h5p",
				clickAction: function(e) {
					ScaffoldBuilder.openH5P()
				}
			},
			'rce-ensemble': {
				icon: "mce-ico mce-i-none",
				icon_bg: "https://tastafe.ensemblevideo.com/settings/resources/lti/chooser/css/images/play_logo16.png",
				label: "Ensemble Video",
				id: "rce-ensemble",
				clickAction: function(e) {
					ScaffoldBuilder.openEnsemble();
					ScaffoldBuilder.selectVideo(e.data.id);
				}
			}
		}
	};

	m.favourites = [];

	m.storage = {
		available: function() {
			try {
				return localStorage.setItem("test", "test"), localStorage.removeItem("test"), true
			} catch (e) {
				return false
			}
		},
		deleteItem: function(e) {
			ScaffoldBuilder.storage.available() && localStorage.removeItem(e)
		},
		getItem: function(e) {
			if (ScaffoldBuilder.storage.available()) return JSON.parse(localStorage.getItem(e))
		},
		setItem: function(e, t) {
			ScaffoldBuilder.storage.available() && localStorage.setItem(e, JSON.stringify(t))
		}
	};

	m.hoverIndicator = function() {
		$(ScaffoldBuilder.editor.dom.select("#tinymce")).on("mouseover mouseout", "[data-context-menu]", function(event) {
			event.stopPropagation();

			if (!ScaffoldBuilder.options.enabled) return false;

			if ("mouseover" == event.type) {
				$(this).addClass("hover");
			} else {
				$(this).removeClass("hover");
			}
		});
	};

	m.getCourseID = function() {
        if (ScaffoldBuilder.options['courseid'] === undefined) {
            if (window?.ENV?.COURSE_ID) {
                ScaffoldBuilder.options['courseid'] = window.ENV.COURSE_ID;
            } else {
                if (document.getElementById('cbt-courseid')) {
                    ScaffoldBuilder.options['courseid'] = document.getElementById('cbt-courseid').getAttribute('data-course-id');
                } else if (document.getElementById('cbt-progress')) {
                    ScaffoldBuilder.options['courseid'] = document.getElementById('cbt-progress').getAttribute('data-course-id');
                } else if(window.location.pathname.match(/(courses)\/[0-9]{1,}/gi)) {
                    var id = window.location.pathname.match(/(courses)\/[0-9]{1,}/gi)[0].split("courses/");
                    ScaffoldBuilder.options['courseid'] = id[id.length - 1];
                }
            }
        }
        return ScaffoldBuilder.options.courseid;
	};

    m.getOrigin = function() {
        return ScaffoldBuilder.options.origin;
    };

	m.getPageTitle = function() {
		if (ScaffoldBuilder.options['pagetitle'] !== undefined) return ScaffoldBuilder.options['pagetitle'];
        var pageTitle = "";
        //get page title
        if (document.getElementsByClassName("page-title") && document.getElementsByClassName("page-title").length > 0 ){
            pageTitle = document.getElementsByClassName("page-title")[0].innerHTML;
        } else if (document.querySelectorAll(".ellipsible") && document.querySelectorAll(".ellipsible").length > 2){
            pageTitle = document.querySelectorAll(".ellipsible")[document.querySelectorAll(".ellipsible").length-1].innerText
        } else if (document.title){
            pageTitle = document.title;
        }

        ScaffoldBuilder.options['pagetitle'] = pageTitle;
        return ScaffoldBuilder.options.pagetitle;

	};

	m.logevent = function(event, id, payload) {
		
	};

	m.toggleScaffold = function() {
		
		ScaffoldBuilder.destroyContextMenu();
		$('[data-context-menu]', $(ScaffoldBuilder.editor.dom.select("#tinymce"))).removeClass("hover");
		if (!ScaffoldBuilder.options.enabled) {
			ScaffoldBuilder.options.enabled = true;
			$(ScaffoldBuilder.editor.dom.select('body')[0]).removeClass( 'scaffold-disabled' );
			$('a.disable-template-link').removeClass('active');
			$('a.disable-template-link i').removeClass('icon-off').addClass('icon-eye');
			$('a.disable-template-link').addClass('active').attr('title', 'Disable Scaffold');
			$('#scaffold-dock').removeClass('disabled');
		} else {
			ScaffoldBuilder.options.enabled = false;
			$(ScaffoldBuilder.editor.dom.select('body')[0]).addClass( 'scaffold-disabled' );
			$('a.disable-template-link').addClass('active').attr('title', 'Enable Scaffold');
			$('a.disable-template-link i').addClass('icon-off').removeClass('icon-eye');
			$('#scaffold-dock').addClass('disabled');
			if ($('.template-link-wrapper .element-wrapper').is(':visible')) {
				$('.template-link-wrapper .element-wrapper').hide();
				$('#right-side-wrapper.with-scaffold').addClass('closed');
				$('#scaffold-dock').addClass('closed');
			}
		}
	};

	m.convertToScaffold = function(id, menu) {
		if (!ScaffoldBuilder.options.enabled) return false;
		var elm = ScaffoldBuilder.editor.dom.get(id);
		if (elm) {
			if ($(elm)[0].nodeName.toLowerCase() != 'div') {
				if (!$(elm).attr('data-keep-id'))
					$(elm).removeAttr('id');

				$(elm).removeAttr('data-limit-actions').removeAttr('data-context-menu');
				
				$(elm).removeClass('selected');

				$(elm).replaceWith(
					$('<div></div>').attr({'data-context-menu': menu.join(' '), 'id': ScaffoldBuilder.createUniqueId()}).addClass('scaffold-media-box').html(
						elm.outerHTML
					)
				);
			} else {
				$(elm).addClass('scaffold-media-box').attr({'data-context-menu': menu.join(' ')}).removeAttr('data-limit-actions');
				$(elm).removeClass('selected');
			}
		}
	};

	m.createContextMenu = function(menuItems, uniqueId, element) {
		if (!ScaffoldBuilder.options.enabled) return false;
		var items = [];
		menuItems.forEach((item, i) => {
			var image = '';
			if (ScaffoldBuilder.context.menuItem[item] === undefined) {
				return;
			}
			if (ScaffoldBuilder.context.menuItem[item].condition !== undefined) {
				if (!ScaffoldBuilder.context.menuItem[item].condition(element)) {
					return;
				}
			}
			if (ScaffoldBuilder.context.menuItem[item].hasOwnProperty('icon_bg')) {
				image = '<img src="' + ScaffoldBuilder.context.menuItem[item].icon_bg + '">';
			}
			items.push('<button class="' + ScaffoldBuilder.context.menuItem[item].id + '"><span><i class="' + ScaffoldBuilder.context.menuItem[item].icon + '">'+ image +'</i>&nbsp;' + ScaffoldBuilder.context.menuItem[item].label + "</span></button>");
		});

		var html = '<div class="context-menu-wrapper" style="" data-id="' + uniqueId + '"><div class="context-menu-inner-wrapper">';
		html += items.join(' | ');
		return html += "</div></div>";
	};
	
	m.addMenuItem = function(item) {
		if (item.hasOwnProperty("icon") &&
		item.icon &&
		item.hasOwnProperty("label") &&
		item.label &&
		item.hasOwnProperty("id") &&
		item.id &&
		item.hasOwnProperty("clickAction") &&
		item.clickAction)
			ScaffoldBuilder.context.menuItem[ item.id ] = item;
	};
	
	m.positionMenu = function(e, uniqueId, element_size) {
		if (!ScaffoldBuilder.options.enabled) return false;
		var size = $('.context-menu-wrapper[data-id="' + uniqueId + '"]')[0].getBoundingClientRect();
    
		ScaffoldBuilder.context.rect.width = size.width;
		ScaffoldBuilder.context.rect.height = size.height;
        
		var frame_size = ScaffoldBuilder.editor.iframeElement.getBoundingClientRect();
		var scrolled = window.scrollY;
    
		//var element_size = ScaffoldBuilder.editor.dom.doc.getElementById(uniqueId).getBoundingClientRect();

		var iframescrolled = ScaffoldBuilder.editor.iframeElement.contentWindow.scrollY;
		var tinyCont = $('.tox-tinymce')[0].getBoundingClientRect();
		var elementtop = $(e)[0].offsetTop;
		
		// console.log('Frame Size', frame_size);
		// console.log('Rect Height', ScaffoldBuilder.context.rect.height);
		// console.log('Element Top', elementtop);
		// console.log('Scrolled', scrolled);
		// console.log('iFrame Scrolled', iframescrolled);

		if (element_size.width >= frame_size.width) {
		  ScaffoldBuilder.context.rect.x = frame_size.x + (frame_size.width - ScaffoldBuilder.context.rect.width) / 2;
		} else {
		  ScaffoldBuilder.context.rect.x = frame_size.x + element_size.x + (element_size.width - ScaffoldBuilder.context.rect.width) / 2;
		}

		if (element_size.y <= (ScaffoldBuilder.context.rect.height + 5)) {
			if (((element_size.y + element_size.height) - elementtop) <= (frame_size.height - ScaffoldBuilder.context.rect.height)) {
				ScaffoldBuilder.context.rect.pointer_position_class = "pointer-top";
				if ((frame_size.y + scrolled + (element_size.height + element_size.y)) > (tinyCont.bottom - ScaffoldBuilder.context.rect.height)) {
					ScaffoldBuilder.context.rect.y = (tinyCont.bottom - ScaffoldBuilder.context.rect.height);
				} else {
					ScaffoldBuilder.context.rect.y = frame_size.y + scrolled + (element_size.height + element_size.y);
				}
			} else {
				ScaffoldBuilder.context.rect.y = frame_size.y + scrolled + ScaffoldBuilder.context.rect.height;
				ScaffoldBuilder.context.rect.pointer_position_class = "pointer-bottom";
			}
		} else {
			ScaffoldBuilder.context.rect.pointer_position_class = "pointer-bottom";
			
			ScaffoldBuilder.context.rect.y = element_size.y + frame_size.y + scrolled - ScaffoldBuilder.context.rect.height - ScaffoldBuilder.context.rect.pointer;
		}

		// if (element_size.y <= 50) {
		//   ScaffoldBuilder.context.rect.y = frame_size.y + element_size.y + scrolled + element_size.height + ScaffoldBuilder.context.rect.pointer;
		//   ScaffoldBuilder.context.rect.pointer_position_class = "pointer-top";
		// } else {
		//   ScaffoldBuilder.context.rect.y = element_size.y + frame_size.y + scrolled - ScaffoldBuilder.context.rect.height - ScaffoldBuilder.context.rect.pointer;
		//   ScaffoldBuilder.context.rect.pointer_position_class = "pointer-bottom";
		// }
		
	
		if($(e)[0].getAttribute('data-context-menu') === "rce-img"){
		  if (element_size.y <= 50) {
			ScaffoldBuilder.context.rect.y -= 45;
		  } else {
			ScaffoldBuilder.context.rect.y += 48;
		  }
		}
	
		$('.context-menu-wrapper[data-id="' + uniqueId + '"]').css({
			visibility: "visible",
			left: ScaffoldBuilder.context.rect.x,
			top: ScaffoldBuilder.context.rect.y
		});

		$('.context-menu-wrapper[data-id="' + uniqueId + '"]').addClass( ScaffoldBuilder.context.rect.pointer_position_class );
	};
	
	m.destroyContextMenu = function() {
		$(ScaffoldBuilder.editor.dom.select("[context-menu]")).removeAttr("id");
		$(".context-menu-wrapper").remove();
		$(window).off("scroll", ScaffoldBuilder.destroyContextMenu);
		$(ScaffoldBuilder.editor.getWin()).off("scroll", ScaffoldBuilder.destroyContextMenu);
	};
	
	m.displayContextMenu = function(element) {
		if (!ScaffoldBuilder.options.enabled) return;
		if ($(element)[0].nodeName.toLowerCase() == 'body') return;

		var parent = ScaffoldBuilder.editor.dom.getParents(element, "[data-context-menu]");
		if (!parent.length && !$(element).attr("data-context-menu")) {
			// find the very top element
			if ($(element).parent()[0].nodeName.toLowerCase() == 'body') {
				$(element).attr({ "data-limit-actions" : true, 'data-context-menu' : 'convert'});
			} else {
				var parents = ScaffoldBuilder.editor.dom.getParents(element);
				if (parents.length) {
					element = parents[0];
					for (var i = 1; i < parents.length; i++) {
						if (parents[i].nodeName.toLowerCase() == 'body') {
							element = parents[i - 1];
							break;
						}
					}
					$(element).attr({ "data-limit-actions" : true, 'data-context-menu' : 'convert', 'data-keep-id' : true});
				}
			}
		}
		if ( ( $(".context-menu-wrapper").length &&
			ScaffoldBuilder.destroyContextMenu(),
		  $(element).attr("data-context-menu") ||
		  (parent.length && $(parent).attr("data-context-menu")))
		) {
			var attr = $(element).attr("data-context-menu") ? element : parent[0];

			$(attr).addClass("selected");
			var uniqueId = ScaffoldBuilder.createUniqueId();
			if (!$(attr).attr('id')) {
				$(attr).attr('id', uniqueId);
			} else {
				uniqueId = $(attr).attr('id');
			}
			var actions = ($(attr).parent()[0].nodeName.toLowerCase() != "body" || $(attr).attr("data-limit-actions")) ? [] : [...ScaffoldBuilder.options.defaultactions];
			var items = $(attr).attr("data-context-menu").split(" ");
			if (items.length) {
				items.forEach((item) => {
					if (!actions.includes(item)) {
						actions.push(item);
					}
				});
			}

			var initpos = ScaffoldBuilder.editor.dom.doc.getElementById(uniqueId).getBoundingClientRect();
			console.log('Initial Pos', initpos);
			$("body").append( ScaffoldBuilder.createContextMenu(actions, uniqueId, attr) );

			ScaffoldBuilder.positionMenu(attr, uniqueId, initpos);
			ScaffoldBuilder.eventToRemove();
	
			actions.forEach((item, i) => {
				if (ScaffoldBuilder.context.menuItem[item] === undefined) return;
				$(".context-menu-wrapper button." + ScaffoldBuilder.context.menuItem[item].id).one("click",{ id: attr},ScaffoldBuilder.context.menuItem[item].clickAction),
				$(".context-menu-wrapper button." + ScaffoldBuilder.context.menuItem[item].id).one("click",ScaffoldBuilder.destroyContextMenu);
			});

            ScaffoldBuilder.editor.dom.removeClass(ScaffoldBuilder.editor.dom.select("[data-context-menu]"), "selected");
            $(attr).addClass("selected");

			$("body").one('click', function() { ScaffoldBuilder.destroyContextMenu(); });

		} else {
            ScaffoldBuilder.editor.dom.removeClass(ScaffoldBuilder.editor.dom.select("[data-context-menu]"), "selected");
			ScaffoldBuilder.destroyContextMenu();
		}
	
		if ($(element).hasClass("template-add-image")) {
			ScaffoldBuilder.openImageModal();
		}
		if ($(element).hasClass("template-add-panopto")) {
			ScaffoldBuilder.openPanopto();
		}
	};
	
	m.displayLastModule = function() {
	  if(ScaffoldBuilder.editor.dom.select("[data-topic-requirement]")){
		var modules = ScaffoldBuilder.editor.dom.select("[data-topic-requirement]");
		var last_module = modules[modules.length -1];
		var add_delete = ScaffoldBuilder.editor.dom.getParents(last_module, '.col-md-4.col-sm-12');
		$(add_delete).attr("data-context-menu", "delete")
	  }
	};

	m.eventToRemove = function() {
		$(window).scroll(ScaffoldBuilder.destroyContextMenu);
		$(ScaffoldBuilder.editor.getWin()).scroll(ScaffoldBuilder.destroyContextMenu);
		$(".switch_views").live("click", function() {
			ScaffoldBuilder.destroyContextMenu();
		});
	};

	m.upload_submit = function() {
		var form = document.querySelector('form[aria-label="Upload Image"]');
		var selected = ScaffoldBuilder.editor.selection.getNode();
		selected.outerHTML = "";
	};

	m.openRCETool = function(d, t) {
		var editorMenu = {
			more: '.tox-tbtn[title="More..."][aria-label="More..."]',
			toolsDropdown: d,
			tool: t
		}

		var mLength = $(editorMenu.more).length;
		var dropdown = $(editorMenu.toolsDropdown).length;
		var tLength = $(editorMenu.tool).length;

		if (tLength){
			$(editorMenu.tool).click();
		} else{
			if (dropdown && !tLength){
			function clickDropDown(tool){
				return new Promise(function(r,e) {
				$(tool).click();
				r();
				});
			}

			clickDropDown(editorMenu.toolsDropdown).then(function(){
				setTimeout(function(){
				$(editorMenu.tool).click();
				if (editorMenu.toolsDropdown === '.tox-split-button[title="Images"], .tox-tbtn[title="Images"]'){
					var upload = document.querySelector('.tox-collection__group .tox-collection__item[title="Upload Image"]');
					upload.addEventListener("click", ScaffoldBuilder.upload_submit);
					upload.addEventListener("keypress", ScaffoldBuilder.upload_submit);
				}
				}, 250);
			});


			//setTimeout($(editorMenu.tool).click(),50);
			} else if (mLength){
				setTimeout(function(){
					$(editorMenu.more).trigger("click");
					if(editorMenu.toolsDropdown){
						setTimeout(function(){$(editorMenu.toolsDropdown).click();},40);
					}
					setTimeout(function(){$(editorMenu.tool).click()},50);
				}, 30);
			}
		}
	};

	m.selectVideo = function(e){
		var selected = $(e).is("iframe") ? e : $(e).find("iframe")[0];
		$(selected).remove();
		selected = $(e).is("span[p-mce-p-title]") ? e : $(e).find("span[data-mce-p-title]")[0];
		$('<br data-mce-bogus="1">').insertBefore($(selected));
		$(selected).remove();
	};

	m.selectImage = function(e) {
		var selected = $(e).is("img") ? e : $(e).find("img")[0];
		if (selected) {
			ScaffoldBuilder.editor.selection.setCursorLocation(selected);
			ScaffoldBuilder.editor.selection.select(selected);
		}
	};

	m.openDocuments = function() {
		ScaffoldBuilder.openRCETool('.tox-split-button[title="Documents"], .tox-tbtn[title="Documents"]', '.tox-collection__item[title="Course Documents"], .tox-collection__item[title="Course Document"]')
	};

	m.openImages = function(e) {
		ScaffoldBuilder.selectImage(e),
		ScaffoldBuilder.openRCETool('.tox-split-button[title="Images"], .tox-tbtn[title="Images"]', null)
	};

	m.openLinks = function() {
		ScaffoldBuilder.openRCETool('.tox-split-button[title="Links"], .tox-tbtn[title="Links"]', '.tox-collection__item[title="Course Links"], .tox-collection__item[title="Edit Link"], .tox-collection__item[title="Course Link"]')
	};

	m.openExternalLinks = function() {
		ScaffoldBuilder.openRCETool('.tox-split-button[title="Links"], .tox-tbtn[title="Links"]', '.tox-collection__item[title="External Links"], .tox-collection__item[title="Edit Link"], .tox-collection__item[title="External Link"]')
	};

	m.openEmbed = function() {
		ScaffoldBuilder.openRCETool(null, '.tox-tbtn[title="Embed"]');
	};

	m.openH5P = function() {
		ScaffoldBuilder.openRCETool('.tox-tbtn[title="Apps"][aria-label="Apps"]', 'span[role="dialog"][aria-label="Apps"] ul li span[role="button"]:contains(H5P)')
	};

	m.openStudio = function() {
		ScaffoldBuilder.openRCETool('.tox-tbtn[title="Apps"][aria-label="Apps"]', 'span[role="dialog"][aria-label="Apps"] ul li span[role="button"]:contains(Studio)')
	};

	m.openYoutube = function() {
		ScaffoldBuilder.openRCETool('.tox-tbtn[title="Apps"][aria-label="Apps"]', 'span[role="dialog"][aria-label="Apps"] ul li span[role="button"]:contains(YouTube)')
	};

	m.openUploadRecordMedia = function() {
		ScaffoldBuilder.openRCETool('.tox-split-button[title="Record/upload media"], .tox-tbtn[title="Record/upload media"]', '.tox-collection__item[title="Upload/Record Media"]')
	};

	m.openEnsemble = function() {
		ScaffoldBuilder.openRCETool('.tox-tbtn[title="Apps"][aria-label="Apps"]', 'span[role="dialog"][aria-label="Apps"] ul li span[role="button"]:contains(Ensemble)')
	};

	m.insertElement = function(source, elm, title, event) {
		if (!ScaffoldBuilder.options.enabled) return false;
		var uniqueId = ScaffoldBuilder.createUniqueId();
		if (elm) {
			var newelem = false;
			if (ScaffoldBuilder.modules[elm] === undefined) {
				ScaffoldBuilder.modules[elm] = {
					id: elm,
					title: title,
					tmpl: source,
					menu: []
				};
				newelem = true;
			}

			var element = $('<div></div>').html(source);
			if (!$('.scaffold-media-box', element).length)
				element.children(":first").addClass("scaffold-media-box");
			
			if ($('.scaffold-media-box', element).length) {
				var customactions = [...ScaffoldBuilder.options.defaultactions];

				var items = $('.scaffold-media-box', element).attr("data-context-menu").split(" ");
				if (items.length) {
					items.forEach((item) => {
						if (!customactions.includes(item)) {
							customactions.push(item);
							if (newelem)
								ScaffoldBuilder.modules[elm].menu.push(item);
						}
					});
				}

				$('.scaffold-media-box', element).attr({"data-context-menu": customactions.join(' '), "data-element-type": elm});
				
				if (!$('.scaffold-media-box', element).attr('id'))
					$('.scaffold-media-box', element).attr("id", uniqueId);

				if ($('.element-wrapper').data('before')) {
					$('.scaffold-media-box', element).insertBefore($( $('.element-wrapper').data('before') ));
				} else if ($('.element-wrapper').data('after')) {
					$('.scaffold-media-box', element).insertAfter($($('.element-wrapper').data('after')));
				} else {
					var myParentNode = ScaffoldBuilder.editor.selection.getNode();
					if (myParentNode.nodeName.toLowerCase() != 'body') {
						var parent = ScaffoldBuilder.editor.dom.getParents(myParentNode, "[data-context-menu]");
						if (parent.length) {
							if (!$('.scaffold-media-box[data-caninsertinto]', element).length || !$('.scaffold-media-box', element).data('caninsertinto')) { // if it can't be inserted into other components, past it after
								$('.scaffold-media-box', element).insertAfter($(parent[0]));
							} else {
								if ($(parent).data('canhavechild')) {
									$('.scaffold-media-box', element).insertAfter($(myParentNode));
								} else {
									var okelem = parent[parent-length - 1]; // the upper most parent will be OK
									for (var i = 0; i < parent.length; i++) { // loop through until we find a parent that allows children
										if ($(parent[i]).data('canhavechild')) {
											okelem = parent[i-1];
											break;
										}
									}
									$('.scaffold-media-box', element).insertAfter($(okelem));
								}
							}
						} else {
                            parent = ScaffoldBuilder.editor.dom.getParents(myParentNode);
    						if (parent.length) {
    							if (!$('.scaffold-media-box[data-caninsertinto]', element).length || !$('.scaffold-media-box', element).data('caninsertinto')) { // if it can't be inserted into other components, past it after
									$('.scaffold-media-box', element).insertAfter($(parent[0]));
								} else {
									if ($(parent).data('canhavechild')) {
										$('.scaffold-media-box', element).insertAfter($(myParentNode));
									} else {
										var okelem = parent[0]; // the upper most parent will be OK
										for (var i = 0; i < parent.length; i++) { // loop through until we find a parent that allows children
											if ($(parent[i]).data('canhavechild')) {
												okelem = parent[i-1];
												break;
											}
										}
										$('.scaffold-media-box', element).insertAfter($(okelem));
									}
								}
    						} else {
    							$(ScaffoldBuilder.editor.dom.select('body')[0]).append( element.html() );
    						}
						}
					} else {
						ScaffoldBuilder.editor.execCommand('mceInsertContent', false, element.html() );
					}
				}
				var log = {
					title
				};
				ScaffoldBuilder.logevent('addcomponent', elm, log);
			}
		} else {
			if (Object.keys(ScaffoldBuilder.modules).length && ScaffoldBuilder.modules[source] !== undefined) {
				var item = ScaffoldBuilder.modules[source];

				if (typeof item.beforeadd === 'function') {
					if (item.beforeadd(event, item) === false)
						return;
				}
				var element = $('<div></div>').html(item.tmpl);
				if (!$('.scaffold-media-box', element).length)
					element.children(":first").addClass("scaffold-media-box")
				
				var customactions = [...ScaffoldBuilder.options.defaultactions];

				$('.scaffold-media-box', element).each(function(idx) {
					var uniqueId = ScaffoldBuilder.createUniqueId();
					if ($(this).attr('data-context-menu')) {
						var codeitms = $(this).attr('data-context-menu');
						if (codeitms) {
							codeitms = codeitms.split(' ');
							if (codeitms.length) {
								codeitms.forEach((menu) => {
									if (!customactions.includes(menu))
										customactions.push(menu);
								});
							}
						}
					}
					if (item.menu.length) {
						item.menu.forEach((menu) => {
							if (!customactions.includes(menu))
								customactions.push(menu);
						});
					}
	
					$(this).attr({"data-context-menu": customactions.join(' '), "data-element-type": source.split('_').filter((itm, idx, all) => idx < (all.length - 1)).join('_')});
	
					if (item.actions !== undefined && item.actions.length) {
						item.actions.forEach((action) => {
							ScaffoldBuilder.addMenuItem(action);
						});
					}
					
					if (!$(this).attr('id'))
						$(this).attr("id", uniqueId);

				});

				if ($('.element-wrapper').data('before')) {
					$('.scaffold-media-box', element).insertBefore($( $('.element-wrapper').data('before') ));
				} else if ($('.element-wrapper').data('after')) {
					$('.scaffold-media-box', element).insertAfter($($('.element-wrapper').data('after')));
				} else {
					if (!$(ScaffoldBuilder.editor.dom.select('body')[0])?.children()?.length || ($(ScaffoldBuilder.editor.dom.select('body')[0])?.children()?.length === 1 && $($(ScaffoldBuilder.editor.dom.select('body')[0])?.children()[0]).prop('nodeName').toLowerCase() === 'p' && (!$($(ScaffoldBuilder.editor.dom.select('body')[0])?.children()[0]).data('context-menu') || $($(ScaffoldBuilder.editor.dom.select('body')[0])?.children()[0]).data('context-menu') === 'convert'))) {
						if (!$(ScaffoldBuilder.editor.dom.select('body')[0])?.children()?.length) {
							ScaffoldBuilder.editor.execCommand('mceInsertContent', false, element.html() );
						} else {
							$($(ScaffoldBuilder.editor.dom.select('body')[0])?.children()[0]).replaceWith(element.html());
						}
					} else {
						var myParentNode = ScaffoldBuilder.editor.selection.getNode();
						if (myParentNode.nodeName.toLowerCase() != 'body') {
							var parent = ScaffoldBuilder.editor.dom.getParents(myParentNode, "[data-context-menu]");
							if (parent.length) {
								if (!$('.scaffold-media-box[data-caninsertinto]', element).length || !$('.scaffold-media-box', element).data('caninsertinto')) { // if it can't be inserted into other components, past it after
									$('.scaffold-media-box', element).insertAfter($(parent[parent.length - 1]));
								} else {
									if ($(parent[0]).data('canhavechild')) {
										$('.scaffold-media-box', element).insertAfter($(myParentNode));
									} else {
										var okelem = parent[parent-length - 1]; // the upper most parent will be OK
										for (var i = 1; i < parent.length; i++) { // loop through until we find a parent that allows children
											if ($(parent[i]).data('canhavechild')) {
												okelem = parent[i-1];
												break;
											}
										}
										$('.scaffold-media-box', element).insertAfter($(okelem));
									}
								}
							} else {
								parent = ScaffoldBuilder.editor.dom.getParents(myParentNode);
								if (parent.length) {
									if (!$('.scaffold-media-box[data-caninsertinto]', element).length || !$('.scaffold-media-box', element).data('caninsertinto')) { // if it can't be inserted into other components, past it after
										$('.scaffold-media-box', element).insertAfter($(parent[0]));
									} else {
										if ($(parent[0]).data('canhavechild')) {
											$('.scaffold-media-box', element).insertAfter($(myParentNode));
										} else {
											var okelem = parent[0]; // the upper most parent will be OK
											for (var i = 1; i < parent.length; i++) { // loop through until we find a parent that allows children
												if ($(parent[i]).data('canhavechild')) {
													okelem = parent[i-1];
													break;
												}
											}
											$('.scaffold-media-box', element).insertAfter($(okelem));
										}
									}
								} else {
									$(ScaffoldBuilder.editor.dom.select('body')[0]).append( element.html() );
								}
							}
						} else {
							ScaffoldBuilder.editor.execCommand('mceInsertContent', false, element.html() );
						}
					}
				}
				if (typeof item.afteradd === 'function') {
					item.afteradd(event, item, uniqueId);
				}
				var log = {
					title: item?.title
				};
				ScaffoldBuilder.logevent('addcomponent', source, log);
			}
		}
		
		$('.element-wrapper').data({ 'before': null, 'after' : null });
	};
	
	m.deleteCustomSetting = function() {
		var namespace = ScaffoldBuilder.settings.name;
		var payload = {
			ns: namespace
		};
		return new Promise(function(a, t) {
			$.ajax({
				url: "/api/v1/users/self/custom_data/" + namespace,
				type: "DELETE",
				data: payload
			}).fail(function(e) {
				t(e)
			}).done(function(e) {
				var t = JSON.parse(e.data);
				a(t)
			})
		})
	};

	m.getCustomSetting = function() {
		var namespace = ScaffoldBuilder.settings.name;
		var payload = {
			ns: namespace
		};
		return new Promise(function(a, t) {
			$.ajax({
				url: "/api/v1/users/self/custom_data/" + namespace,
				type: "GET",
				data: payload
			}).fail(function(e) {
				t(e)
			}).done(function(e) {
				var t = JSON.parse(e.data);
				a(t)
			})
		})
	};
	
	m.putCustomSetting = function(e) {
		var t = JSON.stringify(e);
		var namespace = ScaffoldBuilder.settings.name;
		var payload = {
			ns: namespace,
			data: t
		};
		return new Promise(function(t, a) {
			$.ajax({
				url: "/api/v1/users/self/custom_data/" + namespace,
				type: "PUT",
				data: payload
			}).done(function(e) {
				t(e)
			}).fail(function(e) {
				a(e)
			})
		})
	};

	m.getFavourite = function() {
		
	};
	
	m.addFavourite = function(a) {
		if (ScaffoldBuilder.enablefavourites) {
			var x = ScaffoldBuilder.settings.favourites.map(function(item) { return item.element_id; }).indexOf(a.element_id);
			if (!ScaffoldBuilder.checkFavourite(a)) { // favourite does not exist
				ScaffoldBuilder.settings.favourites.push(a); // add to array
				ScaffoldBuilder.putCustomSetting(ScaffoldBuilder.settings); // save custom setting
				ScaffoldBuilder.updateFavourites();
				return true;
			} else { // favourite exists
				return false;
			}
		}
		return false;
	};
	
	m.checkFavourite = function(a) {
		if (ScaffoldBuilder.enablefavourites) {
			var x = ScaffoldBuilder.settings.favourites.map(function(item) { return item.element_id; }).indexOf(a.element_id);
			if (x === -1) {
				return false;
			} else {
				return true;
			}
		}
		return false;
	};
	
	m.deleteFavourite = function(e) {
		if (ScaffoldBuilder.enablefavourites) {
			var removeIndex = ScaffoldBuilder.settings.favourites.map(function(item) { return item.element_id; }).indexOf(e.element_id);
			ScaffoldBuilder.settings.favourites.splice(removeIndex, 1);
			ScaffoldBuilder.putCustomSetting(ScaffoldBuilder.settings);
			$('.element-item[data-element-id="' + e.element_id + '"] i').removeClass('yellow');
			ScaffoldBuilder.updateFavourites();
		}
	};

	m.updateFavourites = function() {
		return new Promise(function(e, t) {
			var html = "";
			var items = ScaffoldBuilder.settings.favourites.sort((a,b) => {
				if (a.name.toLowerCase() < b.name.toLowerCase()) return 1;
				if (a.name.toLowerCase() > b.name.toLowerCase()) return -1;
				return 0;
			});
			ScaffoldBuilder.settings.favourites = items;
			for (var key in ScaffoldBuilder.settings.favourites) {
				var item = items[key];
				html += '<div class="element-item" data-element-id="' + item.element_id + '" data-category="' + item.category + '"' + ((item.element !== undefined) ? ' data-element="' + item.element + '"' : ' data-url="' + item.url + '"') + '><button class="element-action" tabindex="0">';
				html += '<span class="name with-favourites">' + item.name + '<span class="favourite">';
				html += '<i class="icon-star yellow" tabindex="0"></i>'
				html += "</span></span></button></div>";
			}
			$('.accordion-content', $("#favourites")).html(html), e(true);
		});
	};

	m.showModal = function(heading, body, actionText, callback, variables, closeCallback) {
		var html = '<div class="modal-container">';
		html += '<div style="background-color: rgba(0, 0, 0, 0.5);" class="ReactModal__Overlay ReactModal__Overlay--after-open ReactModal__Overlay--canvas"><div  class="ReactModal__Content ReactModal__Content--after-open ReactModal__Content--canvas"><div class="ReactModal__Layout">';
		html += '<div class="ReactModal__Header"><div class="ReactModal__Header-Title"><h4>' + heading + '</h4></div>';
		html += '<div class="ReactModal__Header-Actions"><button class="modal-cancel-btn Button Button--icon-action" type="button"><i class="icon-x" ></i><span class="screenreader-only">Close</span></button></div>';
		html += '</div>';
		html += '<div class="ReactModal__Body">' + body + "</div>";
		html += '<div class="ReactModal__Footer"><div class="ReactModal__Footer-Actions">';
		html += '<button type="button" class="btn btn-default modal-cancel-btn">Cancel</button>';
		html += '<button type="submit" class="btn btn-primary modal-action-btn">' + actionText + '</button>';
		html += '</div></div>';
		html += '</div></div></div></div>';
		$("body").append(html);
		$(".modal-container .modal-cancel-btn").off("click");
		$(".modal-container .modal-cancel-btn").on("click", function(e) {
			e.preventDefault();
			$(".modal-container").remove();
		});
		$(".modal-container .modal-action-btn").off("click");
		$(".modal-container .modal-action-btn").on("click", function(e) {
			e.preventDefault();
			variables ? callback(variables) : callback();
			closeCallback || $(".modal-container").remove();
		})
	};

	m.getComponents = function() {
        console.log("get compoents");
		// to provide all the components via a provided objects
			
		var html = '<div class="template-link-wrapper"><a href="#" class="template-link">Insert  element</a><div class="element-wrapper" style="display: none;"></div></div>';
		if (ScaffoldBuilder.options.editorposition === 1) {
			if ($('#discussion-details-tab').length && (ScaffoldBuilder.disableassignment === undefined || !ScaffoldBuilder.disableassignment)) {
				$("#discussion-details-tab > .control-group").first().after(
					$('<div></div>').addClass('edit-header scaffold-element-insert').append(html)
				);
			} else {
				if ($('.edit-header').length){
					$(".edit-header").append(html);
				} else {
					if ($('#edit_course_syllabus_form').length && (ScaffoldBuilder.disablesyllabus === undefined || !ScaffoldBuilder.disablesyllabus)) {
						$("#edit_course_syllabus_form").prepend(
							$('<div></div>').addClass('edit-header scaffold-element-insert').append(html)
						);
					}
					if ($('#quiz_options_form').length && (ScaffoldBuilder.disablequiz === undefined || !ScaffoldBuilder.disablequiz)) {
						$("#quiz_options_form > div > .title").after(
							$('<div></div>').addClass('edit-header scaffold-element-insert').append(html)
						);
					}
					if ($('#edit_assignment_form').length && (ScaffoldBuilder.disableassignment === undefined || !ScaffoldBuilder.disableassignment)) {
						$("#edit_assignment_wrapper > .control-group").first().after(
							$('<div></div>').addClass('edit-header scaffold-element-insert').append(html)
						);
					}
				}
			}
		} else {

			html = '<div class="edit-header scaffold-dock closed" id="scaffold-dock"><div class="template-link-wrapper"><div class="element-wrapper" style="display: none;"></div><div class="template-actions"><a href="#" class="template-link" tabindex="0"><svg width="98" height="98" viewBox="0 0 98 98" fill="none" xmlns="http://www.w3.org/2000/svg">' +
			'<g clip-path="url(#clip0_480_1304)">' +
			'<path d="M43.24 51.86H3.35C2.91007 51.86 2.47445 51.7733 2.06801 51.605C1.66157 51.4366 1.29227 51.1899 0.981192 50.8788C0.670116 50.5677 0.423357 50.1984 0.255004 49.792C0.0866503 49.3855 0 48.9499 0 48.51L0 25.94C0 25.0515 0.352945 24.1994 0.981192 23.5712C1.60944 22.9429 2.46152 22.59 3.35 22.59H43.24C43.6799 22.59 44.1155 22.6766 44.522 22.845C44.9284 23.0134 45.2977 23.2601 45.6088 23.5712C45.9199 23.8823 46.1666 24.2516 46.335 24.658C46.5033 25.0644 46.59 25.5001 46.59 25.94V48.51C46.59 48.9499 46.5033 49.3855 46.335 49.792C46.1666 50.1984 45.9199 50.5677 45.6088 50.8788C45.2977 51.1899 44.9284 51.4366 44.522 51.605C44.1155 51.7733 43.6799 51.86 43.24 51.86ZM6.71 45.15H39.88V29.29H6.71V45.15Z" fill="#FF585D"/>' +
			'<path d="M94.26 74.41H43.26C42.8193 74.4113 42.3826 74.3256 41.975 74.1579C41.5674 73.9901 41.1969 73.7436 40.8847 73.4324C40.5726 73.1211 40.325 72.7514 40.156 72.3443C39.987 71.9372 39.9 71.5008 39.9 71.06V48.49C39.9 48.0492 39.987 47.6128 40.156 47.2057C40.325 46.7986 40.5726 46.4289 40.8847 46.1176C41.1969 45.8064 41.5674 45.5599 41.975 45.3921C42.3826 45.2244 42.8193 45.1387 43.26 45.14H94.26C94.7008 45.1387 95.1375 45.2244 95.5451 45.3921C95.9527 45.5599 96.3232 45.8064 96.6353 46.1176C96.9474 46.4289 97.1951 46.7986 97.3641 47.2057C97.533 47.6128 97.62 48.0492 97.62 48.49V71.06C97.62 71.5008 97.533 71.9372 97.3641 72.3443C97.1951 72.7514 96.9474 73.1211 96.6353 73.4324C96.3232 73.7436 95.9527 73.9901 95.5451 74.1579C95.1375 74.3256 94.7008 74.4113 94.26 74.41ZM46.59 67.71H90.91V51.85H46.59V67.71Z" fill="#FF585D"/>' +
			'<path d="M94.26 29.28H43.26C42.8188 29.28 42.3819 29.1931 41.9742 29.0243C41.5666 28.8554 41.1961 28.6079 40.8841 28.2959C40.5721 27.9839 40.3246 27.6135 40.1558 27.2058C39.9869 26.7982 39.9 26.3613 39.9 25.92V3.35001C39.9 2.46327 40.2516 1.6127 40.8777 0.984736C41.5038 0.356776 42.3533 0.00266193 43.24 1.49267e-05H94.24C94.6808 -0.00130081 95.1175 0.0843785 95.5251 0.252143C95.9327 0.419907 96.3032 0.666457 96.6153 0.977665C96.9274 1.28887 97.1751 1.65862 97.3441 2.06571C97.513 2.47281 97.6 2.90924 97.6 3.35001V25.92C97.6 26.8077 97.2488 27.6593 96.623 28.2889C95.9972 28.9184 95.1477 29.2747 94.26 29.28ZM46.59 22.57H90.91V6.71001H46.59V22.57Z" fill="#FF585D"/>' +
			'<path d="M94.26 97.67H3.35C2.91007 97.67 2.47445 97.5834 2.06801 97.415C1.66157 97.2466 1.29227 96.9999 0.981192 96.6888C0.670116 96.3777 0.423357 96.0084 0.255004 95.602C0.0866503 95.1956 0 94.7599 0 94.32L0 71.06C0 70.1715 0.352945 69.3194 0.981192 68.6912C1.60944 68.063 2.46152 67.71 3.35 67.71H94.26C94.7008 67.7087 95.1375 67.7944 95.5451 67.9621C95.9527 68.1299 96.3231 68.3765 96.6353 68.6877C96.9474 68.9989 97.1951 69.3686 97.364 69.7757C97.533 70.1828 97.62 70.6192 97.62 71.06V94.32C97.62 94.7608 97.533 95.1972 97.364 95.6043C97.1951 96.0114 96.9474 96.3812 96.6353 96.6924C96.3231 97.0036 95.9527 97.2501 95.5451 97.4179C95.1375 97.5856 94.7008 97.6713 94.26 97.67ZM6.71 91H90.91V74.41H6.71V91Z" fill="#FF585D"/>' +
			'</g>' +
			'<defs>' +
			'<clipPath id="clip0_480_1304">' +
			'<rect width="98" height="98" fill="white"/>' +
			'</clipPath>' +
			'</defs>' +
			'</svg><span class="insert-text">Insert Element</span></a><a href="#" class="disable-template-link" tabindex="0" title="Disable Scaffold"><i class="icon-eye"></i></a></div></div></div>';
			$('#right-side-wrapper').addClass('with-scaffold closed');
			$('body').append(html);
		}


		if (Object.keys(ScaffoldBuilder.modules).length) {
			if (ScaffoldBuilder.componentmenu !== undefined && ScaffoldBuilder.componentmenu.length) {
				var htmlElements = "";
				var found = 0;
				for (var i = 0; i < ScaffoldBuilder.componentmenu.length; i++) {
					if (ScaffoldBuilder.componentmenu[i].items === undefined || !ScaffoldBuilder.componentmenu[i].items.length) continue;
					var items = "";
					for (let j = 0; j < ScaffoldBuilder.componentmenu[i].items.length; j++) {
						var key = ScaffoldBuilder.componentmenu[i].items[j];
						if (ScaffoldBuilder.modules[key] === undefined) continue;
						items += '<div class="element-item" data-element-id="' + ScaffoldBuilder.modules[key].id + '" data-element="' + ScaffoldBuilder.modules[key].id + '" data-category="default"><button class="element-action" tabindex="0">';
						if (ScaffoldBuilder.modules[key].icon_code !== undefined && ScaffoldBuilder.modules[key]?.icon_code != '') {
							items += '<span class="icon">' + ScaffoldBuilder.modules[key].icon_code + '</span>';
						}
						items += '<span class="name' + ((ScaffoldBuilder.enablefavourites) ? ' with-favourites' : '') + '">' + ScaffoldBuilder.modules[key].title;
						if (ScaffoldBuilder.enablefavourites) {
							items += '<span class="favourite">';
							if(ScaffoldBuilder.checkFavourite({element_id: ScaffoldBuilder.modules[key].id})){
								items += '<i class="icon-star yellow" tabindex="0"></i>'
							}else{
								items += '<i class="icon-star" tabindex="0"></i>'
							}
							items += '</span>';
						}
						items += '</span></button></div>';
					}
					if (items != '') {
						htmlElements += '<div class="element-group accordion-list' + ((!found) ? ' active': '') + '"><button class="accordion-header" tabindex="0">' + ScaffoldBuilder.componentmenu[i].name +' <i class="cbt-icon-down icon-mini-arrow-down"></i></button><div class="accordion-content">'+ items + '</div></div>';
						found = 1;
					}
				}
				$('.element-wrapper', $('.edit-header')).append(htmlElements);
			} else {
				var items = "";
				for (var key in ScaffoldBuilder.modules) {
					items += '<div class="element-item" data-element-id="' + ScaffoldBuilder.modules[key].id + '" data-element="' + ScaffoldBuilder.modules[key].id + '" data-category="default"><button class="element-action">';
					if (ScaffoldBuilder.modules[key].icon_code !== undefined && ScaffoldBuilder.modules[key]?.icon_code != '') {
						items += '<span class="icon">' + ScaffoldBuilder.modules[key].icon_code + '</span>';
					}
					items += '<span class="name' + ((ScaffoldBuilder.enablefavourites) ? ' with-favourites' : '') + '">' + ScaffoldBuilder.modules[key].title;
					if (ScaffoldBuilder.enablefavourites) {
						items += '<span class="favourite">';
						if(ScaffoldBuilder.checkFavourite({element_id: ScaffoldBuilder.modules[key].id})){
							items += '<i class="icon-star yellow"></i>'
						}else{
							items += '<i class="icon-star"></i>'
						}
						items += '</span>';
					}
					items += '</span></button></div>';
				}
				
				var html = '<div class="element-group accordion-list active"><button class="accordion-header" tabindex="0">Default Elements</button><div class="accordion-content">'+ items + '</div></div>';
				if ($('.element-wrapper', $('.edit-header')).length){
					$('.element-wrapper', $('.edit-header')).append(html);
				}
			}
			
		}

		if (ScaffoldBuilder.options.template_id !== undefined) {
			$.ajax({
				url: ScaffoldBuilder.getOrigin() + "/api/v1/courses/" + ScaffoldBuilder.options.template_id + "/modules?include=items&per_page=100"
			}).then(function(result) {
				let anchor = $('.edit-header');
				let menu = $(".edit-header #block-ui");
				if ($('.switch_views_container .help_dialog').length) {
					anchor = $('.switch_views_container .help_dialog');
					menu = $(".switch_views_container .help_dialog #block-ui");
				}
				var htmlElements = "";
				var found = 0;
				for (var i = 0; i < result.length; i++) {
					var items = "";
					for (let j = 0; j < result[i].items.length; j++) {
						items += '<div class="element-item" data-element-id="' + result[i].items[j].page_url  + '" data-url="' + result[i].items[j].url + '" data-category="custom_' + result[i].id + '"><button class="element-action" tabindex="0">';
						//items = items + '<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="edit" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" class="svg-inline--fa fa-edit fa-w-18 fa-3x"><path fill="currentColor" d="M402.6 83.2l90.2 90.2c3.8 3.8 3.8 10 0 13.8L274.4 405.6l-92.8 10.3c-12.4 1.4-22.9-9.1-21.5-21.5l10.3-92.8L388.8 83.2c3.8-3.8 10-3.8 13.8 0zm162-22.9l-48.8-48.8c-15.2-15.2-39.9-15.2-55.2 0l-35.4 35.4c-3.8 3.8-3.8 10 0 13.8l90.2 90.2c3.8 3.8 10 3.8 13.8 0l35.4-35.4c15.2-15.3 15.2-40 0-55.2zM384 346.2V448H64V128h229.8c3.2 0 6.2-1.3 8.5-3.5l40-40c7.6-7.6 2.2-20.5-8.5-20.5H48C21.5 64 0 85.5 0 112v352c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V306.2c0-10.7-12.9-16-20.5-8.5l-40 40c-2.2 2.3-3.5 5.3-3.5 8.5z" class=""></path></svg>';
						items += '<span class="name' + ((ScaffoldBuilder.enablefavourites) ? ' with-favourites' : '') + '">' + result[i].items[j].title;
						if (ScaffoldBuilder.enablefavourites) {
							items += '<span class="favourite">';
							if(ScaffoldBuilder.checkFavourite({element_id: result[i].items[j].page_url})){
								items += '<i class="icon-star yellow" tabindex="0"></i>'
							}else{
								items += '<i class="icon-star" tabindex="0"></i>'
							}
							items += '</span>';
						}
						items += '</span></button></div>';
					}

					if (items != '') {
						htmlElements += '<div class="element-group accordion-list' + ((!found) ? ' active': '') + '"><button class="accordion-header" tabindex="0">' + result[i].name +' <i class="cbt-icon-down icon-mini-arrow-down"></i></button><div class="accordion-content">'+ items + '</div></div>';
						found = 1;
					}
				}
				if ($('.element-wrapper', $('.edit-header')).length){
					$('.element-wrapper', $('.edit-header')).append(htmlElements);
					if (ScaffoldBuilder.enablefavourites) {
						$('.element-wrapper', $('.edit-header')).append('<div class="element-group accordion-list" id="favourites"><button class="accordion-header" tabindex="0">Favourites <i class="cbt-icon-down icon-mini-arrow-down"></i></button><div class="accordion-content"></div></div>');
						ScaffoldBuilder.updateFavourites(ScaffoldBuilder.settings.favourites);
						ScaffoldBuilder.initTemplateAccordionList();
					}
				}
			});
		} else {
			if ($('.element-wrapper', $('.edit-header')).length && ScaffoldBuilder.enablefavourites){
				$('.element-wrapper', $('.edit-header')).append('<div class="element-group accordion-list" id="favourites"><button class="accordion-header" tabindex="0">Favouritesss <i class="cbt-icon-down icon-mini-arrow-down"></i></button><div class="accordion-content"></div></div>');
				ScaffoldBuilder.updateFavourites(ScaffoldBuilder.settings.favourites);
				ScaffoldBuilder.initTemplateAccordionList();
			}
		}

		if (ScaffoldBuilder.options.afterGetCompontents !== undefined) {
			ScaffoldBuilder.options.afterGetCompontents();
		}
	};
	
	m.createUniqueId = function() {
		return "element-" + (((1+Math.random())*0x10000000000000)|0).toString(16).substring(1);
	};
	
	m.templateListAccordionToggle = function(event){
		var code;
		event.stopPropagation();
		event.preventDefault();
		if (event.type === "keypress") {
			code = event.charCode || event.keyCode;
		}
		if (event.type === "click" || code === 32 || code === 13) {
			var p = $(event.currentTarget).parent();
			if(!p.hasClass('active')){
				$('.template-link-wrapper .accordion-list').removeClass('active');
				p.addClass('active');
			} else {
				$('.template-link-wrapper .accordion-list').removeClass('active');
			}
		}
	};
	  
	m.initTemplateAccordionList = function(){
		$('.template-link-wrapper .accordion-list .accordion-header').each(function() {
			this.addEventListener("click", ScaffoldBuilder.templateListAccordionToggle);
			this.addEventListener("keypress", ScaffoldBuilder.templateListAccordionToggle);
		});
		
		if (ScaffoldBuilder.enablefavourites && $('.accordion-content .element-item', $("#favourites")).length) {
			$('.template-link-wrapper .accordion-list').removeClass('active');
			$("#favourites").addClass('active');
		}
	};

    m.fetchstatus = function(response) {
        if (response.status >= 200 && response.status < 300) {
             return Promise.resolve(response)
        } else {
             return Promise.reject(new Error(response.statusText))
        }
    };

    /*
    * Function which returns json from response
    */
    m.fetchjson = function(response) {
        return response.json()
    };

    
        m.setModuleCardsCompletion = function(modulesList) {
            if (modulesList) {
    // get valid modules list
    // get completion status of valid modules
    let modulesInfoList = [];//Array of example object - {"id": module_id, "published": true, "hasProgressTracking": true}
    Array.from(modulesList).forEach((module) => {
        let hasProgressTracking = false;
        if (module.hasOwnProperty("items")) {
            //console.log(`module completion status = ` + module.state);
            hasProgressTracking = module.items.some((item) => item ? (item.hasOwnProperty("completion_requirement") ? true : false) : false);
        }
        modulesInfoList.push({ id: module.id, state: module.state, hasProgressTracking: hasProgressTracking, isManual: false });
    });

    // modulesInfoList.forEach((item) => {
    //     console.log("mod info list" + JSON.stringify(item));
    // });
    // https://genutraining.instructure.com/courses/263/modules/752 -- valid
    // https://genutraining.instructure.com/courses/263/modules/items/6133
    // https://genutraining.instructure.com/courses/263/pages/course-overview-sample?module_item_id=6133

    let moduleCardsArray = document.querySelectorAll(".cbt-module-cards-simple");
    Array.from(moduleCardsArray).forEach((moduleCards) => {
        let cards = moduleCards.querySelectorAll(".cbt-module-card");

        let course_id = ScaffoldClient.getCourseID();
        //let correctLinkType = origin + "/courses/" + course_id + "/modules";

        Array.from(cards).forEach((card, i) => {
            let cardLink = card.querySelector(".cbt-overlay a");

            if(i < modulesInfoList.length){
                let iconElement = card.querySelector(".cbt-card-status");
                let currentModuleIndex = i;
                /*if ( correctLinkType === cardLink.href.substring(0, correctLinkType.length) && !isNaN( cardLink.href.substring(correctLinkType.length + 1) ) ) {
                    let correctModuleID = cardLink.href.substring(correctLinkType.length + 1);
                    let currentModuleInfo = modulesInfoList.reduce((acc, curr, index, arr) => {
                        if(!acc.id === correctModuleID){
                            if(curr.id == correctModuleID)
                            return curr;
                        }
                        return acc;
                    }, false);
                    currentModuleIndex = currentModuleInfo ? modulesInfoList.indexOf(currentModuleInfo): i;
                }*/
                //console.log("> " + currentModuleIndex)
                if (modulesInfoList[currentModuleIndex].hasProgressTracking) {
                    iconElement.classList.add("cbt-icon-incomplete");
                    if (modulesInfoList[currentModuleIndex].state === "completed") {
                        iconElement.classList.remove("cbt-icon-incomplete");
                        iconElement.classList.add("cbt-icon-completed");
                    }
                }
                else {
                    iconElement.classList.remove("cbt-icon-completed");
                    iconElement.classList.remove("cbt-icon-incomplete");
                }
            }
        });
    });

}
        };

        m.getProgressPie = async function() {
            /* Circular progress bar */
return new Promise(function (pieRes, pieRej) {
  if(!ScaffoldClient.courseData || !ScaffoldClient.courseData.modules || ScaffoldClient.courseData.modules == 0){
    //console.log('cannot find course Data :(', !ScaffoldClient.courseData, !ScaffoldClient.courseData.modules, ScaffoldClient.courseData.modules == 0);
    let moduleItemUrl = origin + "/api/v1/courses/" + ScaffoldClient.getCourseID() + "/modules?per_page=100&include[]=items";
    ScaffoldClient.preloadPromises.push(ScaffoldClient.fetchResults(moduleItemUrl, ScaffoldClient.courseData.saveModuleItems));
  } else {
    const progressPie = {
      coursePercentage:  "0%",
      moduleCompletedCount:0,
      moduleCount: 0,
      left_deg: 0,
      right_deg: 0,
      right_color:"var(--cbt-progress-incomplete-colour)",
    };

    var completedModules = ScaffoldClient.courseData.modules.filter((m)=> {return m.state === 'completed'})
    if(completedModules) progressPie.moduleCompletedCount = completedModules.length;

    var publishedModules = ScaffoldClient.courseData.modules.filter((m)=> {return (typeof m.published === 'undefined' || m.published === true)})
    if(publishedModules) progressPie.moduleCount = publishedModules.length;

    //circular progress bar
    if(progressPie.moduleCount > 0){
      var percent = Math.round((progressPie.moduleCompletedCount / progressPie.moduleCount) * 100);
      progressPie.coursePercentage = percent + "%";

      progressPie.right_deg = Math.round(90 + 360 * progressPie.moduleCompletedCount / progressPie.moduleCount);
      if (progressPie.right_deg >= 270) {
        progressPie.right_color = "var(--cbt-progress-colour)";
        progressPie.right_deg = 90;
        progressPie.left_deg = Math.round(360 * progressPie.moduleCompletedCount / progressPie.moduleCount - 180);
      }
    }
    pieRes(progressPie);
  }
}).catch(function (e) {
    // Suppress warnings when canceled
    if (!(e instanceof Bottleneck.BottleneckError)) {
        console.log(`getProgressPie Error: ${e}`);
        Promise.reject(e);
    } else {
        console.log(`Error: ${e}`);
        Promise.reject(e);
    }
});
        };

        m.getContinueItem = async function(course_id) {
            return new Promise(function (continueRes, continueRej) {
  /* Circular progress bar */
  if(!ScaffoldClient.courseData || !ScaffoldClient.courseData.modules || ScaffoldClient.courseData.modules == 0){
    //console.log('cannot find course Data :(');
    let moduleItemUrl = origin + "/api/v1/courses/" + ScaffoldClient.getCourseID() + "/modules?per_page=100&include[]=items";
    ScaffoldClient.fetchResults(moduleItemUrl, ScaffoldClient.courseData.saveModuleItems);
  } else {
    var publishedModules = ScaffoldClient.courseData.modules.filter((m)=> {return ( typeof m.published === 'undefined' || m.published === true) && m.state != 'completed'})
    if(publishedModules && publishedModules.length > 0 ) {
      publishedModules.sort(function(a, b) {
          return parseFloat(a.position) - parseFloat(b.position);
      });
      var incompletedModule = publishedModules[0].items;
      var incompletedItem = incompletedModule.find((i) => {return i.completion_requirement && i.completion_requirement.completed === false});
      // console.log(incompletedItem);
      if(incompletedItem){
        incompletedItem['status'] = publishedModules[0].state;
        incompletedItem['module_name'] = publishedModules[0].name;
        incompletedItem['module_item_link'] = ScaffoldClient.getOrigin() + incompletedItem.url.split("/api/v1")[1] + '?module_item_id=' + incompletedItem.id;
        continueRes(incompletedItem);
      } else {
        continueRes(null);
      }
    } else {
      continueRes(null);
    }
  }
}).catch(function (e) {
  // Suppress warnings when canceled
  if (!(e instanceof Bottleneck.BottleneckError)) {
      console.log(`getContinueItem Error: ${e}`);
      Promise.reject(e);
  }
});




        };

        m.tabs = function() {
            // Tab
function tabDisplay(event){
  var code;
  if (event.type === "keypress") {
    code = event.charCode || event.keyCode;
  }
  if (event.type === "click" || code === 32 || code === 13) {
    var t_con = event.currentTarget.closest('.cbt-tabs').getElementsByClassName("cbt-tab-content");
    var tabs = event.currentTarget.closest('.cbt-tabs').getElementsByClassName("cbt-tab-trigger");

    for (i = 0; i < t_con.length; i++) {
      t_con[i].style.display = "none";
      t_con[i].setAttribute('aria-hidden', 'true');
    }

    for (i = 0; i < tabs.length; i++) {
      tabs[i].classList.remove("active");
      tabs[i].setAttribute('aria-expanded', 'false');
    }
    event.currentTarget.setAttribute('aria-expanded', 'true');
    event.currentTarget.closest('.cbt-tabs').querySelector('.cbt-tab-content[data-content='+ event.currentTarget.dataset.content+']').style.display = "block";
    event.currentTarget.closest('.cbt-tabs').querySelector('.cbt-tab-content[data-content='+ event.currentTarget.dataset.content+']').setAttribute('aria-hidden', 'false');
    event.currentTarget.classList.add("active");
  }
}

var i;
var tabs = document.querySelectorAll(".cbt-tabs");
for (let tab of tabs){
    t_con = tab.getElementsByClassName("cbt-tab-content");
    for (i = 1; i < t_con.length; i++) {
        t_con[i].style.display = "none";
    }
}

var triggers = document.getElementsByClassName("cbt-tab-trigger");

for (let trigger of triggers) {
    trigger.tabIndex = "0";
    trigger.role="tab";
    trigger.addEventListener("click", tabDisplay);
    trigger.addEventListener("keypress", tabDisplay);
}

var tab_content = document.getElementsByClassName("cbt-tab-content");

for (let content of tab_content) {
    content.tabIndex = "0";
    content.role="tabpanel";
    var tab_div = content.getElementsByTagName("div");
    for (let container of tab_div) {
        container.tabIndex = "0";
    }
}

        };

        m.returnModuleInfo = async function(pageTitle, course_id) {
            if (course_id === undefined) {
    course_id = ScaffoldClient.getCourseID();
}
return new Promise(function(i , e) {
    fetch(origin + "/api/v1/courses/" + course_id + "/modules?per_page=10000&include[]=items&search_term=" + pageTitle, {
    method: 'GET',
    credentials: 'include',
    headers: {
            "Accept": "application/json",
            "X-CSRF-Token": ScaffoldClient.getCsrfToken()
    }
    })
    .then(ScaffoldClient.fetchstatus)
    .then( ScaffoldClient.fetchjson)
    .then(function(m) {
    var modules = [];
        for( let module of m){
        if (Array.from(module.items).find(item => item.title === pageTitle)) {modules.push(module);}
        }
        /* It is possible the user insert same page in two different modules. We only handle the first one. */
        modules ? i(modules[0]): e(Error("The page is not in any module"));

    }).catch(function(t) {
        e(Error(t))
    })
})
        };

        m.returnModItems = async function(moduleID, course_id) {
            if (course_id === undefined) {
    course_id = ScaffoldClient.getCourseID();
}
return new Promise(function(ic , e, pageNum) {
    var url = ScaffoldClient.getOrigin() + "/api/v1/courses/" + course_id + "/modules/" + moduleID +"/items?per_page=10000";
    if (pageNum !== undefined && pageNum > 1) {
        url += "&page=" + pageNum;
    }
    fetch(url,{
        method: 'GET',
        credentials: 'include',
        headers: {
            "Accept": "application/json",
            "X-CSRF-Token": ScaffoldClient.getCsrfToken()
        }
    }).then(function(response){
        var m = [];
        if (response.status >= 200 && response.status < 300) {
            var resHeader = (response.headers.get("Link")) ? response.headers.get("Link") : '';
            m = response.json();
            var pagination = resHeader.split(',');
            const totalPage = (pagination.length) ? parseInt(pagination[pagination.length-1].split(';')[0].match(/(\?|\&)page=([\d]+)/g)[0].split("=")[1]) : 1;
            if (totalPage != 1) {
                var paginationDetails = {};
                for (let i = 0; i < pagination.length; i++) {
                    var pd = pagination[i].split(';');
                    var key = pd[1].split('=')[1].replace(/[^\w\s]/gi, '');
                    paginationDetails[key] = pd[0];
                }
                if (pagination['current'] !== undefined && pagination['last'] !== undefined && pagination['current'] != pagination['last']) {
                    var results = ScaffoldClient.returnModItems(moduleID, course_id, pagination['current'] + 1);
                    Array.from(results).forEach(function(i, c) {
                        m.push(i)
                    });
                }
            }
        }
        ic(m);
    }).catch(function(t) {
        e(Error(t));
        ic([]);
    })
})
        };

        m.createProgressPie = function(progressPie) {
            if (typeof progressPie === "object" && Number.isInteger(progressPie.right_deg)) {
    html = '<div class="cbt-progress-pie">\
            <div class="cbt-progress-mask-left" style="transform: rotate(' + progressPie.left_deg + 'deg); ">&nbsp;</div> \
            <div class="cbt-progress-mask-right" style="transform: rotate(' + progressPie.right_deg + "deg); background-color: " + progressPie.right_color + '">&nbsp;</div> \
            <p class="cbt-progress-percentage flexbox">' + progressPie.coursePercentage + '</p> \
            </div> <div class="cbt-progress-status">';

    if (progressPie.moduleCompletedCount === progressPie.moduleCount) {
        html += '<p>Well done! You have completed all the modules.</p></div>';
    } else {
        html += '<p>You have completed ' + progressPie.moduleCompletedCount + " / " + progressPie.moduleCount + " modules.</p></div>";
    }
}
document.getElementById("cbt-progress").innerHTML = html;
        };

        m.createContinueBlock = function(continueItem) {
            if(continueItem && continueItem.status != "completed"){
    var page_title = continueItem.title;
    var module_title = continueItem.module_name;
    if (document.getElementById("cbt-progress-current")) {
        document.getElementById("cbt-progress-current").innerHTML =
        '<a class="cbt-overlay" aria-label="' + page_title + '" href="' + continueItem.module_item_link + '"></a>\
        <div class="cbt-progress-current-container">\
            <div class="cbt-progress-current-info"> \
                <p class="strong">Continue...</p>\
                <p>' + module_title + '</p>\
                <h3>' + page_title + '</h3>\
            </div>\
            <div class="cbt-progress-button-container">\
                <p class="cbt-progress-button"> <i class="cbt-progress-button-icon" aria-hidden="true"></i></p> \
            </div>\
        </div>';
    }
} else {
    if (document.getElementById("cbt-progress-current")) {
        document.getElementById("cbt-progress-current").innerHTML =
        '<div class="cbt-progress-current-container">\
            <div class="cbt-progress-current-info">\
            <p class="strong">Congratulations</p>\
            <p>Well done!</p>\
            <h3>You have completed all the modules</h3>\
        </div></div>';
    }
}

        };

	return m;
}(ScaffoldBuilder || {}, jQuery));

// load base css
var loadstyles = [];

var style = 'https://app.getscaffold.co/deploy/f208ea2fee51cac4437ba3923b5c42521d0de202ff0ec085a619533c6a6651dc/web.css';
loadstyles.push(style);

/////// Main Scaffold Includes: Do Not Edit ///////
if (
		(document.location.pathname.toLowerCase().indexOf("/pages") >= 0 && (
			(ENV.WIKI_RIGHTS !== undefined && (ENV.WIKI_RIGHTS?.update || ENV.WIKI_RIGHTS?.create_page))
		))
		|| (document.location.pathname.toLowerCase().indexOf("/syllabus") >= 0 )
		|| ((document.location.pathname.toLowerCase().indexOf("/quizzes") >= 0 || document.location.pathname.toLowerCase().indexOf("/assignments") >= 0 || document.location.pathname.toLowerCase().indexOf("/discussion_topics") >= 0) && ( 
			(document.location.pathname.toLowerCase().indexOf("/edit") >= 0 ) || (document.location.pathname.toLowerCase().indexOf("/new") >= 0 )
		))
	) {
  loadstyles.push('https://app.getscaffold.co/assets/css/scaffoldbuilder.css');

}

for (var i = 0; i < loadstyles.length; i++) {
	var fileref=document.createElement("link");
	fileref.setAttribute("rel", "stylesheet");
	fileref.setAttribute("type", "text/css");
	fileref.setAttribute("href", loadstyles[i]);
	document.getElementsByTagName("head")[0].appendChild(fileref);
}

// load in the client script
document.addEventListener("scaffoldbuilderjscontrolsloaded", function () {
	if (window['ScaffoldBuilder'] !== undefined) {
		//console.log('builderinit');
		if (ScaffoldBuilder.checkInitOk()) {
			ScaffoldBuilder.init();
            ScaffoldBuilder.options.editorposition = 2;
		}
	}
});

document.addEventListener("scaffoldclientjscontrolsloaded", function () {
	if (window['ScaffoldClient'] !== undefined) {
		//console.log('clientinit');
		ScaffoldClient.init();
	}
});

window.addEventListener('load', function() {
	if (window['ScaffoldClient'] !== undefined) {
		//console.log('clientonload');
		ScaffoldClient.onPageLoad();
	}
	if (window['ScaffoldBuilder'] !== undefined) {
		if (ScaffoldBuilder.checkInitOk()) {
			//console.log('builderonload');
			ScaffoldBuilder.onPageLoad();
            ScaffoldBuilder.options.editorposition = 2;
		}
	}
});

// If editing page, load the theme builder for the tinyMCE page
if (
    (document.location.pathname.toLowerCase().indexOf("/pages") >= 0 && (
        (ENV.WIKI_RIGHTS !== undefined && (ENV.WIKI_RIGHTS?.update || ENV.WIKI_RIGHTS?.create_page))
    )) ||
    (document.location.pathname.toLowerCase().indexOf("/syllabus") >= 0) ||
    ((document.location.pathname.toLowerCase().indexOf("/quizzes") >= 0 || document.location.pathname.toLowerCase().indexOf("/assignments") >= 0 || document.location.pathname.toLowerCase().indexOf("/discussion_topics") >= 0) && (
        (document.location.pathname.toLowerCase().indexOf("/edit") >= 0) || (document.location.pathname.toLowerCase().indexOf("/new") >= 0)
    ))
) {
	var path = 'https://cdn.jsdelivr.net/gh/G0dS0n/Scaffold@main/localEditor.js';

	(function() {
		var script = document.createElement('script');
		script.src = path;
		script.async = true;
		script.charset = "UTF-8";
		script.onload = function() {
			fireEvent("scaffoldbuilderjscontrolsloaded");
			
		};	
			function fireEvent(e) {
				var t;
				if (document.createEvent) {
					t = document.createEvent("HTMLEvents");
					t.initEvent(e, true, true);
				} else if (document.createEventObject) {
					t = document.createEventObject();
					t.eventType = e;
				} else {
					t = new CustomEvent(e, {
						bubbles: true,
						cancelable: true
					});
				}
				t.eventName = e;
				document.dispatchEvent(t);
			}
		var firstScript = document.getElementsByTagName("script")[0];
		firstScript.parentNode.insertBefore(script, firstScript);
	})();
}

var path = 'https://curio.instructure.com/files/35038/download';
(function() {
    var script = document.createElement('script');
    script.src = path, script.async = !0, script.charset = "UTF-8", script.onload = function() {
        fireEvent("scaffoldclientjscontrolsloaded")
    };
    var firstScript = document.getElementsByTagName("script")[0];

    function fireEvent(e) {
        var t;
        document.createEventObject || document.createEvent ? (document.createEvent ? (t = document.createEvent("HTMLEvents")).initEvent(e, !0, !0) : document.createEventObject && ((t = document.createEventObject()).eventType = e), t.eventName = e) : t = new CustomEvent(e, {
            bubbles: !0,
            cancelable: !0
        }), document.dispatchEvent(t)
    }
    firstScript.parentNode.insertBefore(script, firstScript);
})();

/////// End Main Scaffold Includes ///////
