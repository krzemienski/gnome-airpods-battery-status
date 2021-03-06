/**
 * Created by Julien "delphiki" Villetorte (delphiki@protonmail.com)
 */
const Main = imports.ui.main;
const { Clutter, GLib, St, Gio } = imports.gi;
const ByteArray = imports.byteArray;
const Mainloop = imports.mainloop;
const Me = imports.misc.extensionUtils.getCurrentExtension();

let batteryStatus;
let statusFilePath = '/tmp/airstatus.out';
let cacheTTL = 3600;

class AipodsBatteryStatus {
    constructor(menu, filePath) {
        this._menu = menu;
        this._statusFilePath = filePath;
        this._box = new St.BoxLayout();

        this._timeout = null;
        this._currentStatusValue = {};
        this._cache = {
            leftUpdatedAt: null,
            rightUpdatedAt: null,
            caseUpdatedAt: null,
        };
        this._leftAirpodLabel = null;
        this._rightAirpodLabel = null;
        this._icon = null;
        this._caseLabel = null;
        this._caseIcon = null;

        this.buildLayout();
    }

    getCurrentStatus() {
        if (!GLib.file_test(this._statusFilePath, GLib.FileTest.EXISTS)) {
            return {};
        }

        let fileContents = GLib.file_get_contents(this._statusFilePath)[1];

        let lines;
        if (fileContents instanceof Uint8Array) {
            lines = ByteArray.toString(fileContents).trim().split('\n');
        } else {
            lines = fileContents.toString().trim().split('\n');
        }

        let lastLine = lines[lines.length - 1];

        return lastLine.length > 0 ? JSON.parse(lastLine) : {};
    }

    updateBatteryStatus() {
        this._currentStatusValue = this.getCurrentStatus();

        let charge = this._currentStatusValue.hasOwnProperty("charge") ? this._currentStatusValue.charge : {};
        let statusDate = this._currentStatusValue.hasOwnProperty('date') ? Date.parse(this._currentStatusValue.date) : null;
        let now = Date.now();
        let cacheLimitDate = now - (cacheTTL * 1000);
        let statusTooOld = statusDate < cacheLimitDate;

        if (!statusTooOld && charge.hasOwnProperty('left') && charge.left !== -1) {
            this._leftAirpodLabel.set_text(charge.left+' %');
            this._cache.leftUpdatedAt = statusDate;
        } else if (
            this._cache.leftUpdatedAt === null
            || this._cache.leftUpdatedAt < cacheLimitDate
        ) {
            this._leftAirpodLabel.set_text('- %');
        }

        if (!statusTooOld && charge.hasOwnProperty('right') && charge.right !== -1) {
            this._rightAirpodLabel.set_text(charge.right+' %');
            this._cache.rightUpdatedAt = statusDate;
        } else if (
            statusTooOld
            || this._cache.rightUpdatedAt === null
            || this._cache.rightUpdatedAt < cacheLimitDate
        ) {
            this._rightAirpodLabel.set_text('- %');
        }

        if (!statusTooOld && charge.hasOwnProperty('case') && charge.case !== -1) {
            this._caseLabel.set_text(charge.case+' %');
            this._cache.caseUpdatedAt = statusDate;
            this._caseLabel.show()
            this._caseIcon.show();
        } else if (
            statusTooOld
            || this._cache.caseUpdatedAt === null
            || this._cache.caseUpdatedAt < cacheLimitDate
        ) {
            this._caseLabel.hide()
            this._caseIcon.hide();
        }

        return true;
    }

    buildLayout() {
        this._leftAirpodLabel = new St.Label({
            text: '- %',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: "left-airpod-label"
        });

        this._icon = new St.Icon({
            gicon: Gio.icon_new_for_string(Me.path + '/airpods.svg'),
            style_class: "system-status-icon",
        });

        this._rightAirpodLabel = new St.Label({
            text: '- %',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: "right-airpod-label"
        });

        this._caseIcon = new St.Icon({
            gicon: Gio.icon_new_for_string(Me.path + '/case.svg'),
            style_class: "system-status-icon",
        });

        this._caseLabel = new St.Label({
            text: '- %',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: "right-airpod-label"
        });

        this._box.add(this._leftAirpodLabel)
        this._box.add(this._icon);
        this._box.add(this._rightAirpodLabel);
        this._box.add(this._caseIcon);
        this._box.add(this._caseLabel);
    }

    enable() {
        this._menu.insert_child_at_index(this._box, 0);

        let self = this;
        this._timeout = Mainloop.timeout_add(10000, function() {
            return self.updateBatteryStatus();
        });
    }

    disable() {
        this._menu.remove_child(this._box);
        Mainloop.source_remove(this._timeout);
    }
}

function enable() {
    let menu = Main.panel.statusArea["aggregateMenu"]._power;
    batteryStatus = new AipodsBatteryStatus(menu, statusFilePath);
    batteryStatus.enable();
}

function disable() {
    batteryStatus.disable();
    batteryStatus = null;
}

let Log = function(msg) {
    log("[Airpods Battery Status] " + msg);
}
