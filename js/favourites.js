var API_URL = './api.php';
var apiKey = localStorage.getItem('apikey') || '3a160d66562032f9';

document.addEventListener('DOMContentLoaded', function (){
    if (!apiKey){
        window.location.href = 'login.html';
        return;
    }
    fetchAndRenderFavourites();
});

//fetching users favs from api and rendering them
function fetchAndRenderFavourites(){
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API_URL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function (){
        if (xhr.readyState != 4){
            return;
        }
        if (xhr.status >= 200 && xhr.status < 300){
            try{
                var resp = JSON.parse(xhr.responseText);
                if (resp.status === 'success'){
                    renderFavourites(resp.data);
                }
                else{
                    showError('Could not load favourites: ' + resp.data);
                }
            }
            catch (er){
                console.error('Parse error: ',er);
                showError('Unexpected error.');
            }
        }
        else{
            console.error('HTTP', xhr.status, xhr.responseText);
            showError('Failed to fetch favourites.');
        }
    };

    xhr.send(JSON.stringify({
        type: 'GetFavourites',
        apikey: apiKey
    }));
}

function renderFavourites(products){
    var container = document.querySelector('.favourites-container');
    container.innerHTML = '';

    if (!products || products.length === 0){
        container.innerHTML = '<p>No favourites yet.</p>';
        return;
    }

    for (var i = 0; i < products.length; i++){
        var p = products[i];
        var link = document.createElement('a');
        link.className = 'favourite-card';

        link.innerHTML = '<span class="remove-fav" title="Remove"><i class="fa-solid fa-xmark"></i></span>' +
        '<img src="' + p.Image_url + '" alt="' + p.Title + '">' +
        '<div class="fav-desc">' +
        '<h5>' + p.Title + '</h5>' +
        '<h4>R' + (p.LowestPrice ? p.LowestPrice.toLocaleString() : ' ') + '</h4>' +
        '</div>' +
        '<span class="compare-fav" title="Compare"><i class="fa-solid fa-arrow-right-arrow-left"></i></span>';

        container.appendChild(link);

        (function(pid,cardEl){
            var btn = cardEl.querySelector('.remove-fav');
            btn.addEventListener('click', function (e){
                e.prventDefault();
                e.stopPropagation();
                //backend: remove from favorites request
                removeFavourite(pid, cardEl);
                cardEl.parentNode.removeChild(cardEl);
            });
        })(p.productID, link);
    }
}

function showError(msg){
    var container = document.querySelector('.favourites-container');
    container.innerHTML = '<p class="error">' + msg + '</p>';
}

function removeFavourite(productID){
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API_URL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function (){
        if (xhr.readyState != 4){
            return;
        }
    };
    xhr.send(JSON.stringify({
        type: 'RemoveFavourite',
        apikey: apiKey,
        productID: productID
    }));
}

