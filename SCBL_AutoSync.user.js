// ==UserScript==
// @author      PotcFdk
// @name        SCBL Autoblocker
// @version     0.0.2
// @namespace   https://github.com/SCBL/autoblocker
// @description Auto-ignores all players in the SCBL blocklist.
// @match       http://steamcommunity.com/*
// @match       https://steamcommunity.com/*
// @grant       GM_xmlhttpRequest
// @downloadURL https://raw.githubusercontent.com/SCBL/autoblocker/master/SCBL_AutoSync.user.js
// @updateURL   https://raw.githubusercontent.com/SCBL/autoblocker/master/SCBL_AutoSync.meta.js
// ==/UserScript==

/*
	SCBL Autoblocker - Copyright (c) PotcFdk, 2015

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
*/

function _SCBLUpdate (hidden, callback)
{
    GM_xmlhttpRequest ({
        method: 'GET',
        url: 'https://raw.githubusercontent.com/SCBL/blocklist/master/list.json',
        responseType: 'json',
        onload: function (response) {
            var r1 = cloneInto (response.response, unsafeWindow);
            var r2 = cloneInto (hidden, unsafeWindow);
            callback (r1, r2);
        }
    });
}

unsafeWindow._SCBLUpdate = exportFunction (_SCBLUpdate, unsafeWindow);

// UI

function UI () {
    if (typeof g_steamID != 'string')
        return;

    console.log ("[SCBL] Loading inline script...");

    var SCBL_Format = 1;
    var modal;

    function dismissModal ()
    {
        if (modal)
            return modal.Dismiss ();
    }

    function saveListVersion (list_version)
    {
        localStorage.setItem ('SCBLVersion', list_version);
        console.log ('Updated stored SCBL list version to ' + list_version);
    }

    function onCompleted (list_version, failures)
    {
        console.log ('Finished with ', failures, ' errors.');

        if (failures == 0)
        {
            saveListVersion (list_version);
        }

        dismissModal ();
        ShowAlertDialog ('SCBL',
                         'Sync complete.' + (failures > 0 ? ' ' + failures + ' entries were not added due to errors.' : '')
                        ).done (function () {
            location.reload ();
        });
    }

    function onUpdate (list)
    {
        dismissModal ();
        console.log ('[SCBL] Running update...');
        modal = ShowBlockingWaitDialog ('SCBL', 'Sync in progress, please wait...');

        var failures = 0;
        var completed = 0;

        for (var entry of list.list)
        {
            console.log ('Blocking ', entry.steamid, '...');
            $J.post (
                'https://steamcommunity.com/actions/BlockUserAjax',
                {sessionID: g_sessionID, steamid: entry.steamid}
            ).done (function () {
                console.log ('Blocked ', entry.steamid);
            }).fail (function () {
                console.log ('Error when trying to block ', entry.steamid);
                failures ++;
            }).always (function () {
                completed ++;
                if (completed >= list.list.length)
                    onCompleted (list.metadata.version, failures);
            });
        }
    }

    function onList (list, hidden)
    {
        console.log ('[SCBL] Received list ', list);
        console.log ('[SCBL] List version ', list.metadata.version, ', format version ', list.metadata.format);

        if (SCBL_Format != list.metadata.format)
        {
            console.log ('List format incompatible. Expected format: ' + SCBL_Format + '. Is the script up-to-date?');
            throw new Error ('List format incompatible');
        }

        var stored_version = localStorage.getItem ('SCBLVersion');

        if (list.metadata.version > (stored_version || 0))
        {
            console.log ('[SCBL] List version is newer than the stored list version (' + stored_version + ').');
            onUpdate (list);
        }
        else
        {
            dismissModal ();

            if (!hidden)
                ShowConfirmDialog ('SCBL',
                                   'No blocklist updates found. Doing nothing.\n'
                                   + 'You can always force a sync, if you wish.',
                                   'Force Sync', 'OK').done (function () {
                    console.log ('[SCBL] Forcing update...');
                    onUpdate (list);
                });
        }
    }

    function SCBLUpdate (hidden)
    {
        console.log ('[SCBL] Checking for update...');
        if (!hidden)
            modal = ShowBlockingWaitDialog ('SCBL', 'Checking for SCBL blocklist update...');
        return _SCBLUpdate (hidden, function (data, hidden) {
            onList (data, hidden);
        });
    }

    function SCBLPrompt ()
    {
        ShowConfirmDialog ('SCBL Update',
                           'Do you want to add all people on the SCBL blacklist to your ignore list?',
                           'Yes'
                          ).done (function () {
            SCBLUpdate ();
        });   
    }

    var tabs = document.getElementsByClassName ('sectionTabs')[0];
    if (!tabs)
    {
        throw new Error ('Can not find sectionTabs');
    }
    {
        var tabs_child = tabs.getElementsByClassName ('sectionTabs')[0];
        if (tabs_child)
            tabs = tabs_child;
    }

    var button = document.createElement ('a');
    button.className = 'sectionTab';
    button.setAttribute ('style', 'background-color: rgb(82, 0, 82); border-color: rgb(140, 0, 0);');
    button.addEventListener ('click', SCBLPrompt, false);
    button.innerHTML = 'SCBL Sync';

    tabs.insertBefore (button, tabs.firstChild);

    console.log ("[SCBL] Loaded inline script.");

    // Auto-run

    var now = new Date().getTime();
    var lastRun = sessionStorage.SCBLLastRun || 0;
    var timediff = now - lastRun;

    if (timediff > 3*60*60*1000) // every three hours
    {
        console.log ('[SCBL] Triggering auto-check...');
        SCBLUpdate (true);
        sessionStorage.setItem ('SCBLLastRun', now);
    }
};

var script  = document.createElement ("script");
script.text = '(' + UI.toString () + ')();';
document.body.appendChild (script);