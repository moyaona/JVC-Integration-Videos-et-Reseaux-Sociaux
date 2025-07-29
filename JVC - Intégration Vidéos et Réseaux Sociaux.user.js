// ==UserScript==
// @name         JVC - Intégration Vidéos et Réseaux Sociaux
// @namespace    https://github.com/moyaona
// @version      1.0
// @description  Intègre les vidéos TikTok, Instagram, YouTube et X sur les forums JVC.
// @author       moyaona
// @match        https://www.jeuxvideo.com/forums/*
// @connect      tiktok.com
// @connect      vxinstagram.com
// @connect      publish.twitter.com
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';


    // ===================================================================
    // SECTION 1 : GESTION DES PARAMÈTRES
    // ===================================================================

    // Objet contenant les paramètres par défaut du script.
    const defaultSettings = {
        enableTiktok: true,
        enableInstagram: true,
        enableYoutube: true,
        enableTwitter: true
    };

    /**
     * Charge les paramètres depuis le stockage de Tampermonkey.
     * Si aucun paramètre n'est trouvé, les valeurs par défaut sont utilisées.
     * @returns {object} L'objet des paramètres.
     */
    function loadSettings() {
        const savedSettings = GM_getValue('jvcEmbedSettings_v1.0', JSON.stringify(defaultSettings));
        return JSON.parse(savedSettings);
    }

    /**
     * Sauvegarde l'objet des paramètres dans le stockage de Tampermonkey.
     * @param {object} settings L'objet des paramètres à sauvegarder.
     */
    function saveSettings(settings) {
        GM_setValue('jvcEmbedSettings_v1.0', JSON.stringify(settings));
    }

    // Initialisation des paramètres au lancement du script.
    let settings = loadSettings();
    // Variable globale pour s'assurer que le script du widget Twitter n'est chargé qu'une seule fois.
    let twitterWidgetScriptLoaded = false;


    // ===================================================================
    // SECTION 2 : STYLES ET INTERFACE UTILISATEUR
    // ===================================================================

    // Injection de tous les styles CSS nécessaires via GM_addStyle.
    GM_addStyle(`
        /* Style de l'icône du menu dans la barre d'outils */
        .jvc-embed-settings-icon {
            display: inline-flex;   /* Permet un alignement vertical parfait avec les autres icônes. */
            align-items: center;    /* Centre le SVG verticalement. */
            justify-content: center;/* Centre le SVG horizontalement. */
            width: 19px;
            height: 19px;
            cursor: pointer;
            margin: 0 6px;          /* Espacement harmonieux et identique aux autres icônes. */
            opacity: 0.8;
            transition: opacity 0.2s;
        }
        .jvc-embed-settings-icon:hover { opacity: 1; }
        .jvc-embed-settings-icon svg { fill: #c8c8c8; width: 100%; height: 100%; }

        /* Style du panneau de configuration qui s'ouvre au clic */
        .jvc-embed-settings-menu {
            position: fixed;        /* Positionné par rapport à la fenêtre du navigateur. */
            top: 45px;
            right: 20px;
            background: #252525;
            border: 1px solid #4a4a4a;
            border-radius: 6px;
            padding: 15px;
            z-index: 9999;          /* S'assure qu'il est au-dessus des autres éléments de la page. */
            color: #d6d6d6;
            width: 220px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.5);
        }
        .jvc-embed-settings-menu h4 { margin: 0 0 10px 0; font-size: 16px; border-bottom: 1px solid #4a4a4a; padding-bottom: 5px; }
        .jvc-embed-settings-menu label { display: block; margin-bottom: 8px; cursor: pointer; }
        .jvc-embed-settings-menu input { vertical-align: middle; margin-right: 8px; }
        .jvc-embed-settings-menu .settings-saved-msg { color: #4CAF50; font-size: 12px; text-align: center; margin-top: 10px; display: none; }

        /* Styles généraux pour les conteneurs des médias intégrés */
        .jvc-embed-container { margin: 10px 0; border-radius: 8px; overflow: hidden; background: #000; }
        .jvc-embed-container.ratio-16-9 { position: relative; padding-bottom: 56.25%; height: 0; max-width: 640px; } /* Astuce pour le ratio 16:9 de YouTube */
        .jvc-embed-container.ratio-16-9 iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
        .jvc-embed-container.tiktok-iframe-embed { max-width: 340px; height: 600px; }
        .jvc-embed-container.instagram-native-embed { max-width: 420px; }
        .jvc-embed-container.instagram-iframe-embed { max-width: 540px; }
        .jvc-embed-container.twitter-embed .twitter-tweet { margin: 0 !important; } /* Annule la marge par défaut des tweets intégrés */
        .jvc-embed-container video, .jvc-embed-container img, .jvc-embed-container iframe { width: 100%; height: 100%; border: none; display: block; }
    `);

    /**
     * Crée et insère l'icône du menu et le panneau de configuration dans la page.
     * @param {HTMLElement} container - Le conteneur parent où l'icône doit être ajoutée.
     */
    function createSettingsMenu(container) {
        const settingsIconWrapper = container.querySelector('div'); // Le div qui contient l'icône des paramètres JVC est notre point de repère.
        if (!settingsIconWrapper) return; // Sécurité pour éviter les erreurs si la structure de JVC change.

        // Création de l'élément 'a' qui servira d'icône.
        const iconContainer = document.createElement('a');
        iconContainer.className = 'jvc-embed-settings-icon';
        iconContainer.title = "Paramètres d'intégration des médias";
        iconContainer.innerHTML = `<svg viewBox="0 0 24 24"><path d="M4,4 C2.8954305,4 2,4.8954305 2,6 L2,18 C2,19.1045695 2.8954305,20 4,20 L20,20 C21.1045695,20 22,19.1045695 22,18 L22,6 C22,4.8954305 21.1045695,4 20,4 L4,4 Z M4,6 L20,6 L20,18 L4,18 L4,6 Z M10,9 L10,15 L15,12 L10,9 Z"></path></svg>`;

        // Création du panneau de configuration (initialement caché).
        const menuPanel = document.createElement('div');
        menuPanel.className = 'jvc-embed-settings-menu'; menuPanel.style.display = 'none';
        menuPanel.innerHTML = `<h4>Intégrations Actives</h4><label><input type="checkbox" id="jvc_embed_tiktok" ${settings.enableTiktok ? 'checked' : ''}> TikTok</label><label><input type="checkbox" id="jvc_embed_instagram" ${settings.enableInstagram ? 'checked' : ''}> Instagram</label><label><input type="checkbox" id="jvc_embed_youtube" ${settings.enableYoutube ? 'checked' : ''}> YouTube</label><label><input type="checkbox" id="jvc_embed_twitter" ${settings.enableTwitter ? 'checked' : ''}> Twitter / X</label><div class="settings-saved-msg">Paramètres enregistrés !</div>`;

        // Insertion de l'icône dans le conteneur, juste avant le wrapper de l'icône des paramètres de JVC.
        container.insertBefore(iconContainer, settingsIconWrapper);
        document.body.appendChild(menuPanel); // Le panneau est ajouté au corps du document pour être positionné correctement.

        // Ajout des écouteurs d'événements pour gérer l'affichage du menu.
        iconContainer.addEventListener('click', (e) => { e.stopPropagation(); menuPanel.style.display = menuPanel.style.display === 'none' ? 'block' : 'none'; });
        document.addEventListener('click', () => { menuPanel.style.display = 'none'; }); // Clic n'importe où ailleurs pour fermer.
        menuPanel.addEventListener('click', (e) => { e.stopPropagation(); }); // Clic dans le menu pour ne pas le fermer.

        // Ajout des écouteurs pour sauvegarder les changements dans les paramètres.
        menuPanel.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                settings = { enableTiktok: document.getElementById('jvc_embed_tiktok').checked, enableInstagram: document.getElementById('jvc_embed_instagram').checked, enableYoutube: document.getElementById('jvc_embed_youtube').checked, enableTwitter: document.getElementById('jvc_embed_twitter').checked };
                saveSettings(settings);
                // Affiche un message de confirmation temporaire.
                const msg = menuPanel.querySelector('.settings-saved-msg'); msg.style.display = 'block'; setTimeout(() => { msg.style.display = 'none'; }, 2000);
            });
        });
    }

    // ===================================================================
    // SECTION 3 : LOGIQUE D'INTÉGRATION DES MÉDIAS
    // ===================================================================

    // --- TIKTOK ---
    /**
     * Étape finale pour TikTok : crée une iframe avec l'URL d'intégration officielle.
     * C'est la méthode la plus stable, bien que moins "pure" que la vidéo native.
     * @param {HTMLElement} linkElement L'élément <a> du lien original.
     * @param {string} fullUrl L'URL complète de la vidéo TikTok.
     */
    function embedCleanTikTokVideo(linkElement, fullUrl) {
        const match = fullUrl.match(/\/video\/(\d+)/); // Extrait l'ID de la vidéo.
        if (match && match[1]) {
            const videoId = match[1];
            const embedUrl = `https://www.tiktok.com/embed/v2/${videoId}`;
            const c = document.createElement('div'); c.className = 'jvc-embed-container tiktok-iframe-embed';
            const i = document.createElement('iframe'); i.src = embedUrl; i.setAttribute('scrolling', 'no'); i.setAttribute('allow', 'encrypted-media; autoplay; clipboard-write;'); i.setAttribute('allowfullscreen', 'true');
            c.appendChild(i); linkElement.after(c);
        }
    }
    /**
     * Routeur pour les liens TikTok. Gère les liens courts (vm.tiktok.com) en les résolvant d'abord.
     * @param {HTMLElement} linkElement L'élément <a> du lien.
     * @param {string} url L'URL du lien cliqué.
     */
    function handleTikTok(linkElement, url) {
        linkElement.dataset.processed = 'true';
        // Si c'est un lien court, on fait une requête HEAD (rapide) pour obtenir l'URL finale.
        if (url.includes('vm.tiktok.com/') || url.includes('vt.tiktok.com/')) {
            GM_xmlhttpRequest({ method: "HEAD", url: url, onload: (r) => { if (r.finalUrl && r.finalUrl.includes('/video/')) embedCleanTikTokVideo(linkElement, r.finalUrl); } });
        } else { // Si c'est déjà un lien long, on l'intègre directement.
            embedCleanTikTokVideo(linkElement, url);
        }
    }

    // --- INSTAGRAM ---
    /**
     * Gère les liens Instagram. Utilise vxinstagram.com pour déterminer si c'est une vidéo ou un album de photos.
     * Affiche une vidéo native pour les vidéos, et un embed officiel pour les photos/albums.
     * @param {HTMLElement} linkElement L'élément <a> du lien.
     * @param {string} url L'URL du lien cliqué.
     */
    function handleInstagram(linkElement, url) {
        linkElement.dataset.processed = 'true';
        const vxUrl = new URL(url); vxUrl.hostname = 'vxinstagram.com';
        GM_xmlhttpRequest({ method: "GET", url: vxUrl.href, onload: (r) => {
            if (r.status >= 200 && r.status < 300) {
                const doc = new DOMParser().parseFromString(r.responseText, "text/html");
                const videoMeta = doc.querySelector('meta[property="og:video"]'); // Cherche la méta-donnée vidéo.
                // CAS 1: C'est une vidéo.
                if (videoMeta && videoMeta.content) {
                    const c = document.createElement('div'); c.className = 'jvc-embed-container instagram-native-embed';
                    const v = document.createElement('video'); v.src = videoMeta.content; v.controls = true; v.loop = true;
                    c.appendChild(v); linkElement.after(c);
                } else { // CAS 2: C'est une photo ou un album de photos.
                    const m = url.match(/instagram\.com\/(p|reel|reels)\/([a-zA-Z0-9_-]+)/);
                    if (m && m[2]) {
                        // On utilise l'embed officiel pour permettre la navigation dans les carrousels.
                        const embedUrl = `https://www.instagram.com/p/${m[2]}/embed/?cr=1&v=14&wp=540&rd=https%3A%2F%2Fwww.jeuxvideo.com&rp=%2F#%7B%22ci%22%3A0%2C%22os%22%3A1%7D`;
                        const c = document.createElement('div'); c.className = 'jvc-embed-container instagram-iframe-embed';
                        const i = document.createElement('iframe'); i.src = embedUrl; i.setAttribute('scrolling', 'no'); i.style.height = '620px';
                        c.appendChild(i); linkElement.after(c);
                    }
                }
            }
        }});
    }

    // --- YOUTUBE ---
    /**
     * Gère les liens YouTube. Extrait l'ID de la vidéo et crée une iframe d'intégration standard.
     * @param {HTMLElement} linkElement L'élément <a> du lien.
     * @param {string} url L'URL du lien cliqué.
     */
    function handleYouTube(linkElement, url) {
        linkElement.dataset.processed = 'true';
        const m = url.match(/(?:v=|v\/|embed\/|youtu.be\/)([a-zA-Z0-9_-]{11})/); // Regex pour capturer l'ID depuis divers formats.
        if (m && m[1]) {
            const embedUrl = `https://www.youtube.com/embed/${m[1]}`;
            const c = document.createElement('div'); c.className = 'jvc-embed-container ratio-16-9';
            const i = document.createElement('iframe'); i.src = embedUrl; i.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'); i.setAttribute('allowfullscreen', 'true');
            c.appendChild(i); linkElement.after(c);
        }
    }

    // --- TWITTER / X ---
    /**
     * Charge le script du widget de Twitter, une seule fois par page.
     * Ce script est nécessaire pour styliser le tweet intégré.
     */
    function loadTwitterWidgetScript() {
        if (twitterWidgetScriptLoaded) return;
        twitterWidgetScriptLoaded = true;
        const s = document.createElement('script'); s.src = 'https://platform.twitter.com/widgets.js'; s.async = true; document.head.appendChild(s);
    }
    /**
     * Gère les liens Twitter. Utilise l'API oEmbed officielle de Twitter pour obtenir un code d'intégration propre.
     * @param {HTMLElement} linkElement L'élément <a> du lien.
     * @param {string} url L'URL du lien cliqué.
     */
    function handleTwitter(linkElement, url) {
        linkElement.dataset.processed = 'true';
        // On demande à l'API de nous fournir le HTML, en mode sombre et sans inclure le script (on le gère nous-mêmes).
        GM_xmlhttpRequest({ method: "GET", url: `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true&dnt=true&theme=dark`, responseType: "json",
            onload: (r) => {
                if (r.status === 200 && r.response && r.response.html) {
                    const c = document.createElement('div'); c.className = 'jvc-embed-container twitter-embed';
                    c.innerHTML = r.response.html;
                    linkElement.after(c);
                    loadTwitterWidgetScript(); // On s'assure que le script de rendu est chargé.
                }
            }
        });
    }


    // ===================================================================
    // SECTION 4 : INITIALISATION ET LANCEUR PRINCIPAL
    // ===================================================================

    /**
     * Fonction principale qui scanne la page à la recherche de liens à traiter.
     * Elle vérifie les paramètres avant d'appeler la fonction de traitement appropriée.
     */
    function embedVideos() {
        const links = document.querySelectorAll('.bloc-message-forum .txt-msg a:not([data-processed])');
        links.forEach(link => {
            const href = link.href;
            if (link.textContent.trim().startsWith('http')) {
                if (settings.enableTiktok && href.includes('tiktok.com/')) { handleTikTok(link, href); }
                else if (settings.enableInstagram && href.includes('instagram.com/')) { handleInstagram(link, href); }
                else if (settings.enableYoutube && (href.includes('youtube.com/') || href.includes('youtu.be/'))) { handleYouTube(link, href); }
                else if (settings.enableTwitter && (href.includes('twitter.com/') || href.includes('x.com/'))) { handleTwitter(link, href); }
            }
        });
    }

    /**
     * Utilitaire qui attend qu'un élément soit disponible dans le DOM avant d'exécuter une fonction.
     * Essentiel pour les scripts qui s'exécutent sur des pages au contenu dynamique.
     * @param {string} selector Le sélecteur CSS de l'élément à attendre.
     * @param {function} callback La fonction à exécuter une fois l'élément trouvé.
     */
    function waitForElement(selector, callback) {
        const interval = setInterval(() => {
            const element = document.querySelector(selector);
            if (element) {
                clearInterval(interval);
                callback(element);
            }
        }, 100);
    }

    // Un MutationObserver surveille les changements dans le DOM (ex: chargement de nouvelles pages de messages)
    // et relance le scan des vidéos si nécessaire.
    const observer = new MutationObserver(() => embedVideos());
    observer.observe(document.body, { childList: true, subtree: true });

    // Lancement initial au chargement du script.
    embedVideos();

    // On attend que le conteneur des icônes de JVC soit prêt, puis on y ajoute notre menu.
    waitForElement('#page-messages-forum > div.layout__row.layout__breadcrumb.layout__row--gutter > div', createSettingsMenu);

})();