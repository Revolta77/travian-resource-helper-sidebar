// ==UserScript==
// @name         Travian Resource Helper Sidebar
// @namespace    https://github.com/Revolta77/travian-resource-helper-sidebar
// @version      1.0.0
// @author       Revolta77
// @homepageURL  https://github.com/Revolta77/travian-resource-helper-sidebar
// @supportURL   https://github.com/Revolta77/travian-resource-helper-sidebar/issues
// @match        *://*.travian.com/*
// @grant        none
// @run-at       start
// ==/UserScript==
//
// Translations: EN + SK only; if you maintain data/resource-helper-locales.js, keep this file in sync.

(function () {
  'use strict';

  console.log('init');

  const STORAGE_KEY = 'travian_resource_targets';

  // -------- I18N (data/resource-helper-locales.js) --------
  const RH_UI_EN = {
    box_title: 'Resource Helper',
    saved_title: 'Saved',
    btn_save: 'Save',
    btn_insert: 'Insert',
    btn_delete: 'Delete',
    err_load_costs: 'Could not load costs on this page.',
    empty_saved: 'No saved entries yet.',
    default_building: 'Building',
    default_unit: 'Unit',
    default_research: 'Research',
    res_wood: 'wood',
    res_clay: 'clay',
    res_iron: 'iron',
    res_crop: 'crop',
    alert_saved_all_zero: 'Saved entry has all values at 0.',
    alert_hero_not_enough: 'Not enough resources in hero inventory.',
    alert_hero_item_missing: 'Resource item not found in inventory.',
    alert_dialog_timeout: 'Dialog did not open in time.',
    alert_market_ratio_missing: 'Could not find market inputs (.inputRatio.stock.isLtr).',
    alert_market_inputs_missing: 'Could not find market inputs.',
    alert_market_exceeds_max: 'Required amount ({res}: {val}) exceeds market maximum ({max}).',
    alert_not_on_market: 'You are not on the marketplace.',
  };

  const RH_UI_SK = {
    box_title: 'Pomocník surovín',
    saved_title: 'Uložené',
    btn_save: 'Uložiť',
    btn_insert: 'Vložiť',
    btn_delete: 'Zmazať',
    err_load_costs: 'Na tejto stránke sa nepodarilo načítať náklady.',
    empty_saved: 'Zatiaľ nemáš uložené položky.',
    default_building: 'Budova',
    default_unit: 'Jednotka',
    default_research: 'Výskum',
    res_wood: 'drevo',
    res_clay: 'hlina',
    res_iron: 'železo',
    res_crop: 'obilie',
    alert_saved_all_zero: 'Uložená položka má všetky hodnoty na 0.',
    alert_hero_not_enough: 'Nie je dosť surovín v inventári hrdinu.',
    alert_hero_item_missing: 'Nenašiel sa predmet surovín v inventári.',
    alert_dialog_timeout: 'Dialóg sa neotvoril včas.',
    alert_market_ratio_missing: 'Nenašiel som vstupy trhu (.inputRatio.stock.isLtr).',
    alert_market_inputs_missing: 'Nenašiel som vstupy trhu.',
    alert_market_exceeds_max: 'Požadované množstvo ({res}: {val}) presahuje maximum na trhu ({max}).',
    alert_not_on_market: 'Nie si na trhu.',
  };

  const RESOURCE_HELPER_LOCALES = {
    en: Object.assign({}, RH_UI_EN),
    sk: Object.assign({}, RH_UI_SK),
  };

  function getResourceHelperLangPack() {
    const attr = (document.documentElement.getAttribute('lang') || 'en').trim();
    const primary = attr.split(/[-_]/)[0].toLowerCase();
    if (primary === 'sk') return RESOURCE_HELPER_LOCALES.sk;
    return RESOURCE_HELPER_LOCALES.en;
  }

  function t(key) {
    const pack = getResourceHelperLangPack();
    const s = pack[key] || RESOURCE_HELPER_LOCALES.en[key] || key;
    return s;
  }

  // -------- STORAGE --------
  function loadQueue() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  }

  function saveQueue(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function addItem(item) {
    const q = loadQueue();
    q.push(item);
    saveQueue(q);
    renderQueue();
  }

  function removeItem(index) {
    const q = loadQueue();
    q.splice(index, 1);
    saveQueue(q);
    renderQueue();
  }

  const ACTION_BUTTON_COOLDOWN_MS = 1000;

  /** Zabráni dvojkliku: deaktivuje tlačidlá počas vykonania akcie a 1 s po nej. */
  function runWithButtonCooldown(buttons, fn) {
    const list = (Array.isArray(buttons) ? buttons : [buttons]).filter(Boolean);
    if (!list.length || list.some(b => b.disabled)) return;
    list.forEach(b => {
      b.disabled = true;
    });
    try {
      fn();
    } finally {
      setTimeout(() => {
        list.forEach(b => {
          b.disabled = false;
        });
      }, ACTION_BUTTON_COOLDOWN_MS);
    }
  }

  // -------- GET DATA FROM PAGE --------
  function toInt(value) {
    return parseInt(String(value || '').replace(/[^\d]/g, ''), 10) || 0;
  }

  function getAvailableResources() {
    return {
      wood: toInt(document.querySelector('.stockBarButton #l1')?.textContent || document.querySelector('#l1')?.textContent),
      clay: toInt(document.querySelector('.stockBarButton #l2')?.textContent || document.querySelector('#l2')?.textContent),
      iron: toInt(document.querySelector('.stockBarButton #l3')?.textContent || document.querySelector('#l3')?.textContent),
      crop: toInt(document.querySelector('.stockBarButton #l4')?.textContent || document.querySelector('#l4')?.textContent),
    };
  }

  function getActiveVillageName() {
    return document.querySelector('div.villageList a.active .name')?.textContent?.trim() || '';
  }

  /** Pred názvy budov / jednotiek / výskumov: „Názov dediny - …“. */
  function withVillagePrefix(title) {
    const v = getActiveVillageName();
    const t = String(title || '').trim();
    if (!v || !t) return t || title;
    return `${v} - ${t}`;
  }

  function computeMissing(cost, available) {
    return {
      wood: Math.max(0, cost.wood - available.wood),
      clay: Math.max(0, cost.clay - available.clay),
      iron: Math.max(0, cost.iron - available.iron),
      crop: Math.max(0, cost.crop - available.crop),
    };
  }

  function hasAnyResourceNeed(row) {
    return row.wood > 0 || row.clay > 0 || row.iron > 0 || row.crop > 0;
  }

  function getBuildingData(available) {
    const contractContainer = document.querySelector('#contract');
    if (!contractContainer) return null;

    const resourceElements = contractContainer.querySelectorAll('.inlineIcon.resource .value');
    if (resourceElements.length < 4) return null;

    const cost = {
      wood: toInt(resourceElements[0]?.textContent),
      clay: toInt(resourceElements[1]?.textContent),
      iron: toInt(resourceElements[2]?.textContent),
      crop: toInt(resourceElements[3]?.textContent),
    };

    const name =
      document.querySelector('h1')?.innerText ||
      document.querySelector('.titleInHeader')?.innerText ||
      t('default_building');

    const missing = computeMissing(cost, available);
    if (!hasAnyResourceNeed(missing)) return null;
    return { name: withVillagePrefix(name), ...missing };
  }

  /** Názov jednotky: v .details .tit sú linky – jeden s img, druhý s textom. */
  function getTroopUnitNameFromContainer(container) {
    const tit = container.querySelector('.details .tit');
    if (!tit) return null;

    const links = tit.querySelectorAll('a');
    for (let i = 0; i < links.length; i++) {
      if (links[i].querySelector('img')) continue;
      const text = links[i].textContent?.trim();
      if (text) return text;
    }

    const fallback = tit.textContent?.trim();
    return fallback || null;
  }

  /**
   * Celkový náklad za riadok jednotky (podľa počtu z inputu).
   * Addon prepisuje .value na súčet za zadaný počet → nenásobiť count.
   */
  function getTroopRowTotalCost(container, count) {
    const resourceElements = container.querySelectorAll('.inlineIcon.resource .value');
    if (resourceElements.length < 4) return null;

    const fromDom = {
      wood: toInt(resourceElements[0]?.textContent),
      clay: toInt(resourceElements[1]?.textContent),
      iron: toInt(resourceElements[2]?.textContent),
      crop: toInt(resourceElements[3]?.textContent),
    };

    const addonLikelyActive = !!container.querySelector('.details .additionalResources');
    if (addonLikelyActive) {
      return { ...fromDom };
    }

    const safeCount = Math.max(1, count);
    return {
      wood: fromDom.wood * safeCount,
      clay: fromDom.clay * safeCount,
      iron: fromDom.iron * safeCount,
      crop: fromDom.crop * safeCount,
    };
  }

  /** Riadky tréningu: .buildActionOverview + fallback na #nonFavouriteTroops / #favouriteTroops (bez duplicít). */
  function getTroopActionContainers() {
    const overview = Array.from(document.querySelectorAll('.buildActionOverview .action:not(.empty)'));
    const legacy = Array.from(
      document.querySelectorAll('#nonFavouriteTroops .action.troop, #favouriteTroops .action.troop')
    );

    if (overview.length && legacy.length) {
      return Array.from(new Set([...overview, ...legacy]));
    }
    if (overview.length) return overview;
    return legacy;
  }

  /**
   * Súčet nákladov za všetky jednotky s počtom > 0; názov „20x A + 10x B“.
   * Chýbajúce suroviny = jeden výpočet oproti skladu (nie súčet riadkových „missing“).
   */
  function getAllTroopsSummary(available) {
    const containers = getTroopActionContainers();
    if (!containers.length) return null;

    const totalCost = { wood: 0, clay: 0, iron: 0, crop: 0 };
    const nameParts = [];

    containers.forEach(container => {
      const input = container.querySelector("input[type='text']");
      if (!input) return;

      const amount = toInt(input.value);
      if (amount <= 0) return;

      const rowCost = getTroopRowTotalCost(container, amount);
      if (!rowCost) return;

      totalCost.wood += rowCost.wood;
      totalCost.clay += rowCost.clay;
      totalCost.iron += rowCost.iron;
      totalCost.crop += rowCost.crop;

      const unitName = getTroopUnitNameFromContainer(container) || t('default_unit');
      nameParts.push(`${amount}x ${unitName}`);
    });

    if (!nameParts.length) return null;

    const name = withVillagePrefix(nameParts.join(' + '));
    const missing = computeMissing(totalCost, available);
    if (!hasAnyResourceNeed(missing)) return null;
    return { name, ...missing };
  }

  function hasResearchSection() {
    return !!document.querySelector('.build_details.researches');
  }

  /** Názov výskumu: .information .title — link bez obrázka (ako jednotky). */
  function getResearchNameFromContainer(researchEl) {
    const title = researchEl.querySelector('.information .title');
    if (!title) return null;

    const links = title.querySelectorAll('a');
    for (let i = 0; i < links.length; i++) {
      if (links[i].querySelector('img')) continue;
      const text = links[i].textContent?.trim();
      if (text) return text;
    }

    return title.textContent?.trim() || null;
  }

  /**
   * Jeden riadok výskumu: chýbajúce suroviny samostatne (nie súčet s ostatnými výskumami).
   */
  function getResearchRowData(researchEl, available) {
    let spans = researchEl.querySelectorAll('.resourceWrapper .resource span.value.value');
    if (spans.length < 4) {
      spans = researchEl.querySelectorAll('.resourceWrapper .resource .value');
    }
    if (spans.length < 4) return null;

    const cost = {
      wood: toInt(spans[0]?.textContent),
      clay: toInt(spans[1]?.textContent),
      iron: toInt(spans[2]?.textContent),
      crop: toInt(spans[3]?.textContent),
    };

    const name = withVillagePrefix(getResearchNameFromContainer(researchEl) || t('default_research'));
    return { name, ...computeMissing(cost, available) };
  }

  function getAllResearchRows(available) {
    if (!hasResearchSection()) return [];
    const rows = [];
    document.querySelectorAll('.build_details.researches .research').forEach(el => {
      const row = getResearchRowData(el, available);
      if (row && hasAnyResourceNeed(row)) rows.push(row);
    });
    return rows;
  }

  function getCurrentData() {
    const available = getAvailableResources();
    const building = getBuildingData(available);
    const troops = getAllTroopsSummary(available);
    const researches = getAllResearchRows(available);

    if (!building && !troops && researches.length === 0) return null;
    return { building, troops, researches };
  }

  function escapeHtml(text) {
    if (text == null) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderNeedBlock(title, wood, clay, iron, crop, saveButtonId) {
    return `
    <div class="resource_helper-need">
        <b>${escapeHtml(title)}</b><br>
        <div class="resource_helper-icons">
            <div><i class="lumber_small"></i></div>
            <div><i class="clay_small"></i></div>
            <div><i class="iron_small"></i></div>
            <div><i class="crop_small"></i></div>
        </div>
        <div class="resource_helper-values">
            <div>${wood}</div>
            <div>${clay}</div>
            <div>${iron}</div>
            <div>${crop}</div>
        </div>
    </div>
    <button type="button" class="btnRes btnRes-save" id="${saveButtonId}">${t('btn_save')}</button>
`;
  }

  function injectResourceHelperStyles() {
    if (document.getElementById('myResourceHelperStyles')) return;
    const st = document.createElement('style');
    st.id = 'myResourceHelperStyles';
    st.textContent = `
      /* Pozíciu pri skrolovaní rieši JS (sticky na Traviane často blokuje overflow na predkoch). */
      #myResourceBox {
        box-sizing: border-box;
      }
      #myResourceBox.myResourceBox--pinned {
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      }
      #myResourceBox .btnRes {
        display: inline-block;
        padding: 4px 10px;
        margin: 4px 6px 2px 0;
        border: none;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        color: #fff;
        line-height: 1.2;
        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
      }
      #myResourceBox .btnRes-save { background: #2e7d32; }
      #myResourceBox .btnRes-save:hover { background: #1b5e20; }
      #myResourceBox .btnRes-insert { background: #1565c0; }
      #myResourceBox .btnRes-insert:hover { background: #0d47a1; }
      #myResourceBox .btnRes-delete { background: #c62828; }
      #myResourceBox .btnRes-delete:hover { background: #b71c1c; }
      #myResourceBox .btnRes:disabled {
        opacity: 0.55;
        cursor: not-allowed;
        filter: grayscale(0.25);
        pointer-events: none;
      }
      #myResourceBox .resource_helper-need { border: 1px solid rgba(94, 70, 58, .4);border-radius: 2px; margin-top: 5px; padding-top: 5px; }
      #myResourceBox .resource_helper-need b { padding-left: 10px; }
      #myResourceBox .resource_helper-icons { display: flex; align-items: center;}
      #myResourceBox .resource_helper-icons div { width: 25%; display: flex; justify-content: center; }
      #myResourceBox .resource_helper-values { display: flex; margin-top: 5px; }
      #myResourceBox .resource_helper-values div { width: 25%; display: flex; justify-content: center; }
    `;
    document.head.appendChild(st);
  }

  /** O koľko px od vrchu viewportu bude box pri pine (0 = úplne hore; zvýš ak má hra fixný header). */
  const MY_RESOURCE_PIN_TOP_PX = 0;
  /** Histerezia pri odpnutí podľa scrollY (px). */
  const MY_RESOURCE_PIN_SCROLL_UNPIN_DELTA = 12;

  /**
   * Sticky nahradené: pri skrolovaní zarovná box na horný okraj viewportu v rámci sidebar stĺpca.
   * Používa #sidebarBeforeContent ak existuje (stĺpec nekolabuje ako priamom rodičovi po fixed).
   * Pin až keď samotný box dosiahne MY_RESOURCE_PIN_TOP_PX, nie keď zmizne celý stĺpec (colRect.top).
   */
  function getMyResourcePinAnchorRect(columnEl, box) {
    const root = box && box.closest('#sidebarBeforeContent, #sidebarAfterContent');
    if (root) {
      const r = root.getBoundingClientRect();
      if (r.width >= 40) return r;
    }
    return columnEl.getBoundingClientRect();
  }

  function clearMyResourceBoxPin(box) {
    delete box._pinScrollY;
    if (!box.classList.contains('myResourceBox--pinned')) return;
    box.classList.remove('myResourceBox--pinned');
    box.style.position = '';
    box.style.top = '';
    box.style.left = '';
    box.style.right = '';
    box.style.width = '';
    box.style.zIndex = '';
    box.style.maxHeight = '';
    box.style.overflowY = '';
  }

  function applyMyResourceBoxPin(box, colRect, stickTopPx) {
    const topPx = typeof stickTopPx === 'number' ? stickTopPx : MY_RESOURCE_PIN_TOP_PX;
    box.classList.add('myResourceBox--pinned');
    box.style.position = 'fixed';
    box.style.top = `${topPx}px`;
    box.style.left = `${Math.round(colRect.left)}px`;
    box.style.width = `${Math.round(colRect.width)}px`;
    box.style.right = 'auto';
    box.style.zIndex = '10050';
    box.style.maxHeight = `calc(100vh - ${topPx}px)`;
    box.style.overflowY = 'auto';
    box.style.boxSizing = 'border-box';
  }

  function updateMyResourceBoxPin(box, columnEl) {
    const colRect = getMyResourcePinAnchorRect(columnEl, box);
    const vh = window.innerHeight;
    const stickTop = MY_RESOURCE_PIN_TOP_PX;

    if (colRect.bottom <= 0 || colRect.top >= vh) {
      clearMyResourceBoxPin(box);
      return;
    }

    const pinned = box.classList.contains('myResourceBox--pinned');
    const scrollY = window.scrollY || window.pageYOffset || 0;

    if (!pinned) {
      const br = box.getBoundingClientRect();
      if (br.top <= stickTop) {
        box._pinScrollY = scrollY;
        applyMyResourceBoxPin(box, colRect, stickTop);
      }
      return;
    }

    if (box._pinScrollY != null && scrollY < box._pinScrollY - MY_RESOURCE_PIN_SCROLL_UNPIN_DELTA) {
      clearMyResourceBoxPin(box);
      return;
    }

    applyMyResourceBoxPin(box, colRect, stickTop);
  }

  function setupMyResourceBoxScrollPin(box, columnEl) {
    if (!box || box.dataset.scrollPinBound === '1') return;
    box.dataset.scrollPinBound = '1';

    let ticking = false;
    function scheduleUpdate() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        updateMyResourceBoxPin(box, columnEl);
      });
    }

    window.addEventListener('scroll', scheduleUpdate, true);
    window.addEventListener('resize', scheduleUpdate);
    scheduleUpdate();
  }

  // -------- UI --------
  function createSidebar() {
    const wrapper =
      document.querySelector('#sidebarBeforeContent .sidebarBoxWrapper') ||
      document.querySelector('.sidebarBoxWrapper');
    if (!wrapper) return;

    if (document.getElementById('myResourceBox')) return;

    injectResourceHelperStyles();

    const box = document.createElement('div');
    box.id = 'myResourceBox';
    box.className = 'sidebarBox expanded';

    box.innerHTML = `
      <div class="content" id="myResourceContent">
        <div class="boxTitle">${escapeHtml(t('box_title'))}</div>
        <div id="needResources"></div>
        <hr>
        <div class="boxTitle" style="color: darkred;">${escapeHtml(t('saved_title'))}</div>
        <div id="savedResources"></div>
      </div>
    `;

    wrapper.append(box);
    setupMyResourceBoxScrollPin(box, wrapper);
    renderCurrent();
    renderQueue();
  }

  function renderCurrent() {
    const needContainer = document.getElementById('needResources');
    if (!needContainer) return;

    const data = getCurrentData();
    if (!data) {
      needContainer.innerHTML =
        '<div style="opacity:0.8;">' + escapeHtml(t('err_load_costs')) + '</div>';
      return;
    }

    const parts = [];

    if (data.building) {
      parts.push(
        renderNeedBlock(
          data.building.name,
          data.building.wood,
          data.building.clay,
          data.building.iron,
          data.building.crop,
          'saveBuildingBtn'
        )
      );
    }

    if (data.troops) {
      if (parts.length) {
        parts.push('<hr style="margin:12px 0;">');
      }
      parts.push(
        renderNeedBlock(
          data.troops.name,
          data.troops.wood,
          data.troops.clay,
          data.troops.iron,
          data.troops.crop,
          'saveTroopsBtn'
        )
      );
    }

    if (data.researches && data.researches.length) {
      data.researches.forEach((row, idx) => {
        if (parts.length) {
          parts.push('<hr style="margin:12px 0;">');
        }
        parts.push(
          renderNeedBlock(row.name, row.wood, row.clay, row.iron, row.crop, 'saveResearchBtn_' + idx)
        );
      });
    }

    needContainer.innerHTML = parts.join('');

    const saveBuilding = needContainer.querySelector('#saveBuildingBtn');
    if (saveBuilding && data.building) {
      saveBuilding.onclick = () => {
        runWithButtonCooldown(saveBuilding, () => {
          addItem({
            name: data.building.name,
            wood: data.building.wood,
            clay: data.building.clay,
            iron: data.building.iron,
            crop: data.building.crop,
          });
        });
      };
    }

    const saveTroops = needContainer.querySelector('#saveTroopsBtn');
    if (saveTroops && data.troops) {
      saveTroops.onclick = () => {
        runWithButtonCooldown(saveTroops, () => {
          addItem({
            name: data.troops.name,
            wood: data.troops.wood,
            clay: data.troops.clay,
            iron: data.troops.iron,
            crop: data.troops.crop,
          });
        });
      };
    }

    if (data.researches && data.researches.length) {
      data.researches.forEach((row, idx) => {
        const saveResearch = needContainer.querySelector('#saveResearchBtn_' + idx);
        if (saveResearch) {
          saveResearch.onclick = () => {
            runWithButtonCooldown(saveResearch, () => {
              addItem({
                name: row.name,
                wood: row.wood,
                clay: row.clay,
                iron: row.iron,
                crop: row.crop,
              });
            });
          };
        }
      });
    }
  }

  /** Oneskorenie po input – Travian/addon aktualizuje .value spany až po ďalšom tiku. */
  const TROOP_INPUT_RENDER_DEBOUNCE_MS = 50;

  function attachNeedResourcesListeners() {
    const troopInputs = document.querySelectorAll(
      ".buildActionOverview .action:not(.empty) input[type='text'], " +
      "#nonFavouriteTroops .action.troop input[type='text'], " +
      "#favouriteTroops .action.troop input[type='text']"
    );
    troopInputs.forEach(input => {
      input.addEventListener('input', function () {
        clearTimeout(this._travianResHelperDebounce);
        this._travianResHelperDebounce = setTimeout(renderCurrent, TROOP_INPUT_RENDER_DEBOUNCE_MS);
      });
      input.addEventListener('change', renderCurrent);
      input.addEventListener('blur', renderCurrent);
    });

    const quickSetLinks = document.querySelectorAll(
      '.buildActionOverview .cta a[href="#"], ' +
      '#nonFavouriteTroops .cta a[href="#"], ' +
      '#favouriteTroops .cta a[href="#"]'
    );
    quickSetLinks.forEach(link => {
      link.addEventListener('click', () => setTimeout(renderCurrent, TROOP_INPUT_RENDER_DEBOUNCE_MS));
    });
  }

  function renderQueue() {
    const savedContainer = document.getElementById('savedResources');
    if (!savedContainer) return;

    const q = loadQueue();
    savedContainer.innerHTML = '';

    if (!q.length) {
      savedContainer.innerHTML =
        '<div style="opacity:0.8;">' + escapeHtml(t('empty_saved')) + '</div>';
      return;
    }

    q.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'queueItem';
      div.style.marginBottom = '10px';

      div.innerHTML = `
        <div class="resource_helper-need">
          <b>${escapeHtml(item.name)}</b><br>
          <div class="resource_helper-icons">
            <div><i class="lumber_small"></i></div>
            <div><i class="clay_small"></i></div>
            <div><i class="iron_small"></i></div>
            <div><i class="crop_small"></i></div>
          </div>
          <div class="resource_helper-values">
            <div>${item.wood}</div>
            <div>${item.clay}</div>
            <div>${item.iron}</div>
            <div>${item.crop}</div>
          </div>
        </div>
        <button type="button" class="btnRes btnRes-delete deleteBtn">${escapeHtml(t('btn_delete'))}</button>
        ${
        isHeroInventoryPage() || hasMarketStockRatioInputs() || isMarketPage()
          ? '<button type="button" class="btnRes btnRes-insert fillBtn">' +
          escapeHtml(t('btn_insert')) +
          '</button>'
          : ''
      }
        <hr>
      `;

      const deleteBtn = div.querySelector('.deleteBtn');
      deleteBtn.onclick = () => {
        runWithButtonCooldown(deleteBtn, () => removeItem(index));
      };

      const fillBtn = div.querySelector('.fillBtn');
      if (fillBtn) {
        fillBtn.onclick = () => {
          runWithButtonCooldown(fillBtn, () => {
            if (isHeroInventoryPage()) {
              fillHeroInventory(item);
            } else if (hasMarketStockRatioInputs()) {
              fillMarketStockRatio(item);
            } else if (isMarketPage()) {
              fillMarket(item);
            }
          });
        };
      }

      savedContainer.appendChild(div);
    });
  }

  // -------- MARKET & HERO INVENTORY --------
  /** Pauza medzi poľami v dialógu inventára (React inak nestihne všetky zmeny). */
  const HERO_INVENTORY_FIELD_DELAY_MS = 500;

  function isMarketPage() {
    return location.href.includes('market') || location.href.includes('build.php');
  }

  /** Nový trh: 4× div.inputRatio.stock.isLtr (drevo, hlina, železo, obilie). */
  function hasMarketStockRatioInputs() {
    return document.querySelectorAll('.inputRatio.stock.isLtr').length >= 4;
  }

  function isHeroInventoryPage() {
    return /\/hero\/inventory/i.test(location.pathname) || location.href.includes('/hero') || location.href.includes('/hero/inventory');
  }

  /** Nosnosť jedného obchodníka (Travian UI). */
  function getMerchantCarryCapacity() {
    const el = document.querySelector('div.merchantCarryInfo strong');
    const n = toInt(el && el.textContent);
    return n > 0 ? n : 0;
  }

  /** Postupné nastavenie 4 polí v dialógu (drevo → hlina → železo → obilie). */
  function scheduleHeroDialogResourceInputs(lumberInput, clayInput, ironInput, cropInput, wood, clay, iron, crop) {
    const steps = [
      { el: lumberInput, val: wood },
      { el: clayInput, val: clay },
      { el: ironInput, val: iron },
      { el: cropInput, val: crop },
    ];
    let delay = 0;
    for (let i = 0; i < steps.length; i++) {
      const el = steps[i].el;
      const val = steps[i].val;
      (function (input, v, ms) {
        setTimeout(function () {
          if (input) setReactInputValue(input, v);
        }, ms);
      })(el, val, delay);
      delay += HERO_INVENTORY_FIELD_DELAY_MS;
    }
  }

  /** Nastavenie hodnoty tak, aby to zachytil React (controlled inputs). */
  function setReactInputValue(input, value) {
    if (!input) return;
    const str = String(value);
    const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    if (desc && desc.set) {
      desc.set.call(input, str);
    } else {
      input.value = str;
    }
    input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /** 145 drevo, 146 hlina, 147 železo, 148 obilie */
  function getHeroResourceCount(itemId) {
    const node = document.querySelector(`.heroItem .item.item${itemId}`);
    if (!node) return 0;
    const heroItem = node.closest('.heroItem');
    return toInt(heroItem?.querySelector('.count')?.textContent);
  }

  function pickHeroItemClickSelector(item) {
    const candidates = [
      { need: item.wood, sel: '.heroItem .item.item145' },
      { need: item.clay, sel: '.heroItem .item.item146' },
      { need: item.iron, sel: '.heroItem .item.item147' },
      { need: item.crop, sel: '.heroItem .item.item148' },
    ];
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i].need > 0 && document.querySelector(candidates[i].sel)) {
        return candidates[i].sel;
      }
    }
    for (let j = 0; j < candidates.length; j++) {
      if (document.querySelector(candidates[j].sel)) return candidates[j].sel;
    }
    return null;
  }

  function fillHeroInventory(item) {
    const wood = item.wood || 0;
    const clay = item.clay || 0;
    const iron = item.iron || 0;
    const crop = item.crop || 0;

    if (wood <= 0 && clay <= 0 && iron <= 0 && crop <= 0) {
      alert(t('alert_saved_all_zero'));
      return;
    }

    const checks = [
      { need: wood, id: 145 },
      { need: clay, id: 146 },
      { need: iron, id: 147 },
      { need: crop, id: 148 },
    ];

    for (let i = 0; i < checks.length; i++) {
      const need = checks[i].need;
      if (need <= 0) continue;
      const have = getHeroResourceCount(checks[i].id);
      if (have < need || !document.querySelector(`.heroItem .item.item${checks[i].id}`)) {
        alert(t('alert_hero_not_enough'));
        return;
      }
    }

    const clickSel = pickHeroItemClickSelector(item);
    if (!clickSel) {
      alert(t('alert_hero_item_missing'));
      return;
    }

    const target = document.querySelector(clickSel);
    if (!target) {
      alert(t('alert_hero_item_missing'));
      return;
    }

    target.click();

    const maxAttempts = 15;
    let attempt = 0;

    function tryFillDialog() {
      const root = document.querySelector('#dialogContent');
      const lumberInput = root?.querySelector('input[name="lumber"]');
      if (root && lumberInput) {
        const clayInput = root.querySelector('input[name="clay"]');
        const ironInput = root.querySelector('input[name="iron"]');
        const cropInput = root.querySelector('input[name="crop"]');
        scheduleHeroDialogResourceInputs(lumberInput, clayInput, ironInput, cropInput, wood, clay, iron, crop);
        return;
      }
      attempt++;
      if (attempt < maxAttempts) {
        setTimeout(tryFillDialog, 100);
      } else {
        alert(t('alert_dialog_timeout'));
      }
    }

    setTimeout(tryFillDialog, 500);
  }

  function fillMarketStockRatio(item) {
    const divs = document.querySelectorAll('.inputRatio.stock.isLtr');
    if (divs.length < 4) {
      alert(t('alert_market_ratio_missing'));
      return;
    }

    const needVals = [item.wood || 0, item.clay || 0, item.iron || 0, item.crop || 0];
    const labelKeys = ['res_wood', 'res_clay', 'res_iron', 'res_crop'];
    const carrierCap = getMerchantCarryCapacity();

    for (let i = 0; i < 4; i++) {
      const input = divs[i].querySelector('input');
      if (!input) {
        alert(t('alert_market_inputs_missing'));
        return;
      }
      const max = toInt(divs[i].querySelector('.denominator')?.textContent);
      const need = needVals[i];
      if (need > max) {
        alert(
          t('alert_market_exceeds_max')
            .replace('{res}', t(labelKeys[i]))
            .replace('{val}', String(need))
            .replace('{max}', String(max))
        );
        return;
      }
    }

    const targets = [];
    for (let k = 0; k < 4; k++) {
      const max = toInt(divs[k].querySelector('.denominator')?.textContent);
      const need = needVals[k];
      let target = need;
      if (need > 0 && carrierCap > 0) {
        target = Math.min(max, Math.max(need, carrierCap));
      }
      targets[k] = target;
    }

    for (let j = 0; j < 4; j++) {
      const input = divs[j].querySelector('input');
      setReactInputValue(input, targets[j]);
    }
  }

  function fillMarket(item) {
    const r1 = document.querySelector('input[name="r1"]');
    const r2 = document.querySelector('input[name="r2"]');
    const r3 = document.querySelector('input[name="r3"]');
    const r4 = document.querySelector('input[name="r4"]');

    if (!r1) return alert(t('alert_not_on_market'));

    r1.value = item.wood;
    r2.value = item.clay;
    r3.value = item.iron;
    r4.value = item.crop;
  }

  // -------- INIT --------
  function init() {
    createSidebar();
    attachNeedResourcesListeners();
  }

  init();

})();