const Cairo = imports.cairo;
const GLib = imports.gi.GLib;
const St = imports.gi.St;

const SCALE_DECAY_PER_SECOND = 0.72;
const SCALE_RAPID_DECAY_PER_SECOND = 0.4;
const RAPID_DECAY_TARGET_RATIO = 0.3;

var SparklineView = class {
    constructor() {
        this.actor = new St.DrawingArea({ style_class: "bandwidth-monitor__sparkline" });
        this.actor.connect("repaint", area => this._repaint(area));
        this._rxHistory = [];
        this._txHistory = [];
        this._height = 42;
        this._scaleMax = 1;
        this._lastScaleUpdateUs = 0;
        this._visible = true;
        this._backgroundColor = [1, 1, 1, 0.05];
        this._rxColor = [0.45, 0.78, 1.0, 0.95];
        this._txColor = [1.0, 0.78, 0.4, 0.95];
    }

    update(rxHistory, txHistory, options = {}) {
        this._rxHistory = rxHistory || [];
        this._txHistory = txHistory || [];
        this._height = options.height || 42;
        this._visible = options.visible !== false;
        this._backgroundColor = options.backgroundColor || [1, 1, 1, 0.05];
        this._rxColor = options.rxColor || [0.45, 0.78, 1.0, 0.95];
        this._txColor = options.txColor || [1.0, 0.78, 0.4, 0.95];
        const currentPeak = Math.max(1, ...this._rxHistory, ...this._txHistory);
        const targetScale = currentPeak * 1.15;
        const nowUs = GLib.get_monotonic_time();
        const elapsedSeconds = this._lastScaleUpdateUs > 0
            ? Math.max(0.001, (nowUs - this._lastScaleUpdateUs) / 1000000)
            : 0;

        if (targetScale >= this._scaleMax) {
            this._scaleMax = targetScale;
        } else {
            const decayPerSecond = targetScale <= (this._scaleMax * RAPID_DECAY_TARGET_RATIO)
                ? SCALE_RAPID_DECAY_PER_SECOND
                : SCALE_DECAY_PER_SECOND;
            const decayFactor = elapsedSeconds > 0 ? Math.pow(decayPerSecond, elapsedSeconds) : decayPerSecond;
            this._scaleMax = Math.max(targetScale, this._scaleMax * decayFactor);
        }

        this._lastScaleUpdateUs = nowUs;

        this.actor.visible = this._visible;
        this.actor.style = `height: ${this._height}px;`;
        this.actor.queue_repaint();
    }

    _repaint(area) {
        if (!this._visible) {
            return;
        }

        const cr = area.get_context();
        const [width, height] = area.get_surface_size();

        cr.setOperator(Cairo.Operator.CLEAR);
        cr.paint();
        cr.setOperator(Cairo.Operator.OVER);

        if (width < 2 || height < 2) {
            return;
        }

        cr.setSourceRGBA(
            this._backgroundColor[0],
            this._backgroundColor[1],
            this._backgroundColor[2],
            this._backgroundColor[3]
        );
        cr.rectangle(0, 0, width, height);
        cr.fill();

        const maxValue = Math.max(1, this._scaleMax);
        this._drawSeries(cr, width, height, this._rxHistory, maxValue, this._rxColor, []);
        this._drawSeries(cr, width, height, this._txHistory, maxValue, this._txColor, [4, 3]);
    }

    _drawSeries(cr, width, height, series, maxValue, color, dash) {
        if (!series || series.length < 2) {
            return;
        }

        const stepX = series.length === 1 ? width : width / (series.length - 1);

        cr.setLineWidth(2.0);
        cr.setDash(dash, 0);
        cr.setSourceRGBA(color[0], color[1], color[2], color[3]);

        series.forEach((value, index) => {
            const x = Math.min(width, index * stepX);
            const y = height - ((Math.max(0, value) / maxValue) * (height - 2)) - 1;

            if (index === 0) {
                cr.moveTo(x, y);
            } else {
                cr.lineTo(x, y);
            }
        });

        cr.stroke();
        cr.setDash([], 0);
    }
};