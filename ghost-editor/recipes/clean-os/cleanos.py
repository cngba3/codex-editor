"""Clean OS builder: the Clean OS house over a talking head, on scripts/lib/facereel.py (like faceresult.py and board.py).
A reel is a short generator in its own project: word-keyed calls to this module and to kit.py, the reel's own NEW
components (HTML + a few tweens), then build(). The plumbing, the house look, the captions and the budgets live here, so a
reel never copies an old generator or writes a lib of its own.

    import sys; sys.path.insert(0, "<skill>/recipes/clean-os"); from cleanos import *; import kit as K
    R = CleanOS("$P", accent="#0A84FF", fixes={"iphone": "iPhone"}, shots="build/cut_plan.json", cover=[(9.1, 9.5)])
    R.figma("hook", "your phone", R.t("phone"), R.t("^phone") + .1, R.t("every"), text_from=0)
    R.top("stime", a, b, '<small>Screen Time</small><b id="stv" class="tabnum">4 h 52 min</b>', h=230)
    K.counter(R, "#stv", 292, 374, a + .2, b - .3, K.hm)
    R.scene("notif", a2, b2, K.status() + K.title("Notifications") + K.rows([...], top=420), enter="iris")
    R.pen("mk1", "quiet", R.t("quiet"), R.t("and", after=R.t("quiet")))
    R.build(special={R.key("less"): {"kind": "qt", "opts": ("later", "less", "never")}}, css=CSS, music="vastness")

    python3 <skill>/recipes/clean-os/cleanos.py --api      prints this API on one screen: read it instead of the source
    python3 <skill>/recipes/clean-os/cleanos.py --new $P --from <clip>/edit     the project from an approved cut (+ face.json)

Project ($P, one folder per reel, e.g. <clip>/edit/cleanos4): assets/plate_alt.mp4 + assets/voice.wav (symlinks to the
approved cut), build/words.cut.json (or words.json), build/face.json (face_track.py ON THE PLATE), optionally
build/cut_plan.json (the cut's plan.json: one slow push per shot) and build/cover_windows.json. build/plan.json is the
builder's output (numbers), never the cut plan.

The house (house.json, SYSTEM.md; the same every reel):
- the speaker's plate AS SHOT (no filter, no grade); one slow push per shot (1.00 -> 1.04); a soft dark fade under the chin;
- compact white Inter Tight anchors on the chest; yellow Dancing Script and white Patrick Hand phrases arrive on speech and accumulate until the thought ends;
- full-screen phone scenes <= 2.5 s that open on the word and leave on the next idea; frame 1 is the speaker's face;
- chest cards below the chin and widgets above the head keep the speaker's face on screen (the guard fails the build on a touch);
- the reference treatment uses a warm yellow accent against white; legacy Figma and phone tools remain available for old projects only;
- one small UI sound per graphic entrance, nothing on bare cuts; a quiet ambient bed under the voice.
Budgets that FAIL the build: face on screen >= 65 %, a scene <= 2.5 s, >= 1.5 s of face between two scenes, <= 3 inserts
a minute, every cover window hidden, nothing on the face. What changes every reel: the scenes, chest / top components,
entrances (enter=), hook and outro (components.py plan --style clean-os); register each new one with a sig.
"""
import inspect
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "scripts", "lib"))
sys.path.insert(0, HERE)
from facereel import Reel, BuildError, SAFE, esc, norm, r3, W, H  # noqa: E402,F401

# entrances / exits: each element carries data-in / data-out = its name (the catalog's transition sigs)
SCENE_IN = {"icon": 0.2, "iris": 0.32, "rise": 0.24, "slide": 0.24, "island": 0.3}
SCENE_OUT = {"swipe": 0.16, "iris": 0.24, "fade": 0.16, "drop": 0.18}
CHEST_IN = ("rise", "slide", "flick", "pop")
TOP_IN = ("drop", "pull", "pop")
FUNC = {"к", "в", "во", "с", "со", "и", "от", "для", "по", "на", "за", "из", "но", "а", "у", "о", "об", "не", "это", "как",
        "когда", "чтобы", "где", "чем", "the", "a", "an", "to", "of", "and", "in", "on", "for", "with", "but", "or"}
POPS = ("pop-1", "pop-2", "pop-3")
CURSOR = ('<svg class="cursor" viewBox="0 0 28 28" width="64" height="64"><path d="M4 2 L4 22 L9.5 17 L13 25 L16.5 23.5 '
          'L13 15.8 L20.5 15.8 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>')


class CleanOS(Reel):
    """One Clean OS reel. Times are edit seconds; get them from words with R.t("word") / R.w("word", near)."""

    def __init__(self, project, accent="#F7E769", fixes=None, shots=None, push=0.0, tail=0.45, cover=None,
                 card_fix=None, proper=(), plate=None, voice="assets/voice.wav", words=None, fps=30):
        super().__init__(project, plate=plate, voice=voice, words=words, fixes=fixes, tail=tail, cover=cover, fps=fps)
        self.acc, self.push, self.card_fix = accent, push, dict(card_fix or {})
        self.proper = {norm(x) for x in proper}
        self.shots = self._shots(shots)
        self.reference_mode = True
        self.scenes, self.overs, self.busy, self.caps = [], [], [], []
        self.H = {k: [] for k in ("top", "chest", "fig", "pen", "hero", "scene", "icon", "extra")}
        fb = self.face_box()
        self.chin = int(fb[3])
        self.icon_xy = (540, int(min(1450, max(1190, fb[3] + 130))))   # an app icon / iris centre on the chest below the chin

    # ---------------------------------------------------------------- words
    def w(self, word, near, end=False):
        """the occurrence of a single word nearest to `near` seconds (W(word, near) in older generators)"""
        n = norm(word)
        hits = [x for x in self.words if n and (x["n"] == n or x["n2"] == n)]
        if not hits or " " in word.strip():
            return self.t(("^" if end else "") + word, after=max(0.0, near - 1.0), what=f"near {near}")
        x = min(hits, key=lambda x: abs(x["s"] - near))
        return r3(x["e"] if end else x["s"])

    def key(self, ref, after=0.0):
        """the key of a word for build(special={...}): its start rounded to 0.01 s"""
        return round(self.t(ref, after), 2)

    def _shots(self, shots):
        if shots is None:
            p = os.path.join(self.P, "build", "cut_plan.json")
            shots = p if os.path.exists(p) else [(0.0, self.T)]
        if isinstance(shots, str):
            p = shots if os.path.isabs(shots) else os.path.join(self.P, shots)
            out, ve = [], 0.0
            for q in json.load(open(p))["pieces"]:
                d = q.get("vb", q["b"]) - q.get("va", q["a"])
                out.append((r3(ve), r3(ve + d)))
                ve += d
            shots = out
        shots = [(float(a), float(b)) for a, b, *_ in shots]
        shots[-1] = (shots[-1][0], self.T)
        return shots

    def xf(self, t, box):
        """the face moves with the slow push (scale 1 + push about 50 % 40 %): guard against the pushed-in face"""
        k, ox, oy = 1 + self.push, 540.0, 0.40 * H
        l, tp, r, b = box
        return [ox + (l - ox) * k, oy + (tp - oy) * k, ox + (r - ox) * k, oy + (b - oy) * k]

    # ---------------------------------------------------------------- small timeline helpers
    def hide(self, sel, at, dur=0.14, y=None):
        to = {"autoAlpha": 0, "duration": dur}
        if y is not None:
            to["y"] = y
        self.tween(sel, {"autoAlpha": 1}, to, at)

    def block(self, a, b):
        """keep the chest captions off [a, b] (an element of the reel's own that sits on the chest)"""
        self.busy.append((r3(a), r3(b)))

    def add(self, html, where="extra"):
        """put the reel's own markup on the page (layers: extra < top < chest < fig < pen < hero < scene)"""
        self.H[where].append(html)

    # ---------------------------------------------------------------- S1 / S2: full-screen phone scenes
    def scene(self, sid, a, b, inner, icon=None, bg="#F2F2F7", enter="icon", exit="swipe", what="", sfx="tech-digital-whoosh",
              cls=""):
        """a full-screen phone scene, fully open at `a` (on the word), gone at `b` (<= 2.5 s; the voice goes on).
        enter: icon (the app opens out of its icon below the chin; icon = kit.icon(...)) | iris (a circle out of the speaker's
        chest) | rise | slide (from the right) | island (grows out of a pill at the top). exit: swipe (home gesture up) |
        iris (closes into the chest) | fade | drop."""
        if enter not in SCENE_IN or exit not in SCENE_OUT:
            raise BuildError(f"{sid}: enter one of {list(SCENE_IN)}, exit one of {list(SCENE_OUT)}")
        d_in, d_out = SCENE_IN[enter], SCENE_OUT[exit]
        if b - a < 0.6:
            raise BuildError(f"{sid}: a scene needs >= 0.6 s fully open ({a:.2f}-{b:.2f})")
        o0 = a - d_in
        if o0 < 0.1:
            raise BuildError(f"{sid}: frame 1 is the speaker's face (this scene starts opening at {o0:.2f} s)")
        self.full_screen(sid, a - 0.08, b, what or sid, cap=2.58, din=0.08, dout=d_out)
        self.scenes.append((sid, r3(a - 0.08), r3(b), enter, exit))
        self.block(o0 - 0.15, b)
        x, y = self.icon_xy
        s = f"#{sid}"
        self.st(s, {"autoAlpha": 1}, o0)
        if enter == "icon":
            ic = (icon or _icon_default()).replace('class="appi"', f'id="{sid}i" class="appi"', 1)
            self.H["icon"].append(f'<div class="appw" style="left:{x - 75}px;top:{y - 75}px">{ic}</div>')
            self.ft(f"#{sid}i", {"autoAlpha": 0, "scale": 0.4, "y": 40}, {"autoAlpha": 1, "scale": 1, "y": 0, "duration": 0.14, "ease": "back.out(2)"}, o0 - 0.16)
            self.ft(s, {"scale": 0.139, "borderRadius": "230px"}, {"scale": 1, "borderRadius": "0px", "duration": d_in, "ease": "power2.in"}, o0)
            self.st(f"#{sid}i", {"autoAlpha": 0}, o0 + 0.06)
            self.sound("tick-1", o0 - 0.16, f"{sid} icon")
        elif enter == "iris":
            self.ft(s, {"clipPath": f"circle(0px at {x}px {y}px)"}, {"clipPath": f"circle(2300px at {x}px {y}px)", "duration": d_in, "ease": "power2.in"}, o0)
        elif enter == "rise":
            self.ft(s, {"y": 320, "opacity": 0}, {"y": 0, "opacity": 1, "duration": d_in, "ease": "power3.out"}, o0)
        elif enter == "slide":
            self.ft(s, {"x": 1080}, {"x": 0, "duration": d_in, "ease": "power3.out"}, o0)
        elif enter == "island":
            self.ft(s, {"clipPath": "inset(36px 370px 1804px 370px round 40px)"}, {"clipPath": "inset(0px 0px 0px 0px round 0px)", "duration": d_in, "ease": "power2.inOut"}, o0)
        self.sound(sfx, o0 - 0.02, f"{sid} in")
        if b < self.T - 0.02:
            t1 = b - d_out
            if exit == "swipe":
                self.tween(s, {"y": 0, "borderRadius": "0px"}, {"y": -1920, "borderRadius": "70px", "duration": d_out, "ease": "power2.in"}, t1)
            elif exit == "iris":
                self.tween(s, {"clipPath": f"circle(2300px at {x}px {y}px)"}, {"clipPath": f"circle(0px at {x}px {y}px)", "duration": d_out, "ease": "power2.out"}, t1)
            elif exit == "fade":
                self.tween(s, {"opacity": 1}, {"opacity": 0, "duration": d_out}, t1)
            elif exit == "drop":
                self.tween(s, {"y": 0}, {"y": 1920, "duration": d_out, "ease": "power2.in"}, t1)
            self.st(s, {"autoAlpha": 0}, b)
            self.sound("whoosh-1", t1, f"{sid} out")
        self.beat(sid, "scene", a, b, what or sid)
        self.H["scene"].append(f'<div id="{sid}" class="scn {cls}" data-in="{enter}" data-out="{exit}" '
                               f'style="background:{bg};transform-origin:{x}px {y}px">{inner}</div>')
        return s

    # ---------------------------------------------------------------- overlays that keep the speaker's face on screen
    def chest(self, oid, a, b, inner, h=300, top=None, left=70, right=70, cls="pip", enter="rise", snd="tech-digital-whoosh",
              what=""):
        """a card on the chest band below the chin (the speaker stays on screen); blocks the chest captions while it is up.
        enter: rise (up from below, blur-resolve) | slide (in from the right, out to the left) | flick (tilts in from the
        left) | pop. cls: pip (white card) | glass (frosted light) | dark."""
        if enter not in CHEST_IN:
            raise BuildError(f"{oid}: enter one of {CHEST_IN}")
        if b - a < 0.5:
            raise BuildError(f"{oid}: needs >= 0.5 s on screen ({a:.2f}-{b:.2f})")
        top = int(top if top is not None else max(1130, self.chin + 40))
        self.guard(f"chest {oid}", (left, top, W - left - right, h), a, b)
        self.block(a - 0.05, b)
        self.overs.append((oid, r3(a), r3(b), "chest", enter))
        s = f"#{oid}"
        IN = {"rise": ({"autoAlpha": 0, "y": 90, "scale": 0.94, "filter": "blur(8px)"}, {"autoAlpha": 1, "y": 0, "scale": 1, "filter": "blur(0px)", "duration": 0.26, "ease": "power3.out"},
                       {"autoAlpha": 0, "y": 70, "duration": 0.18, "ease": "power2.in"}),
              "slide": ({"autoAlpha": 0, "x": 760, "rotation": 5}, {"autoAlpha": 1, "x": 0, "rotation": 0, "duration": 0.3, "ease": "power3.out"},
                        {"autoAlpha": 0, "x": -760, "rotation": -5, "duration": 0.22, "ease": "power2.in"}),
              "flick": ({"autoAlpha": 0, "x": -320, "rotation": -14}, {"autoAlpha": 1, "x": 0, "rotation": 0, "duration": 0.3, "ease": "back.out(1.6)"},
                        {"autoAlpha": 0, "x": 320, "rotation": 12, "duration": 0.2, "ease": "power2.in"}),
              "pop": ({"autoAlpha": 0, "scale": 0.6}, {"autoAlpha": 1, "scale": 1, "duration": 0.28, "ease": "back.out(1.7)"},
                      {"autoAlpha": 0, "scale": 0.9, "duration": 0.14})}[enter]
        self.ft(s, IN[0], IN[1], a)
        if b < self.T - 0.02:
            out = dict(IN[2]); d = out["duration"]
            self.tween(s, {k: v for k, v in IN[1].items() if k not in ("duration", "ease")}, out, b - d)
        if snd:
            self.sound(snd, a - 0.02, f"{oid} in")
        self.beat(oid, "chest", a, b, what or oid)
        self.H["chest"].append(f'<div id="{oid}" class="ov {cls}" data-in="{enter}" style="top:{top}px;left:{left}px;right:{right}px;height:{h}px">{inner}</div>')
        return s

    def top(self, oid, a, b, inner, h=260, top=120, left=60, right=60, cls="wdg", enter="drop", snd="pop-2", what=""):
        """a widget in the top band above the speaker's head; the chest captions keep running under it.
        enter: drop (falls in, back.out) | pull (pulled down from the top edge like Control Center) | pop.
        cls: wdg (dark frosted) | wdg light | glass."""
        if enter not in TOP_IN:
            raise BuildError(f"{oid}: enter one of {TOP_IN}")
        if b - a < 0.5:
            raise BuildError(f"{oid}: needs >= 0.5 s on screen ({a:.2f}-{b:.2f})")
        self.guard(f"top {oid}", (left, top, W - left - right, h), a, b)
        self.overs.append((oid, r3(a), r3(b), "top", enter))
        s = f"#{oid}"
        IN = {"drop": ({"autoAlpha": 0, "y": -60, "filter": "blur(8px)"}, {"autoAlpha": 1, "y": 0, "filter": "blur(0px)", "duration": 0.28, "ease": "back.out(1.4)"},
                       {"autoAlpha": 0, "y": -40, "duration": 0.16, "ease": "power2.in"}),
              "pull": ({"autoAlpha": 1, "y": -(top + h + 40)}, {"autoAlpha": 1, "y": 0, "duration": 0.34, "ease": "power3.out"},
                       {"y": -(top + h + 40), "duration": 0.24, "ease": "power2.in"}),
              "pop": ({"autoAlpha": 0, "scale": 0.85}, {"autoAlpha": 1, "scale": 1, "duration": 0.28, "ease": "back.out(1.7)"},
                      {"autoAlpha": 0, "duration": 0.16})}[enter]
        self.ft(s, IN[0], IN[1], a)
        if b < self.T - 0.02:
            out = dict(IN[2])
            self.tween(s, {k: v for k, v in IN[1].items() if k not in ("duration", "ease")}, out, b - out["duration"])
        if snd:
            self.sound(snd, a, f"{oid} in")
        self.beat(oid, "top", a, b, what or oid)
        self.H["top"].append(f'<div id="{oid}" class="tw {cls}" data-in="{enter}" style="top:{top}px;left:{left}px;right:{right}px;min-height:{h}px">{inner}</div>')
        return s

    # ---------------------------------------------------------------- S3 / S5 / S7: house emphasis devices
    def figma(self, fid, text, a, click, b, mode="focus", size=96, top=1300, text_from=None):
        """the red Figma selection box on the chest. mode: focus (select) | reject (select + strike + dim) | delete (the
        letters are deleted one by one). text_from: the words show (no box yet) from that time, e.g. 0 for the frame-1 hook."""
        if not a <= click <= b - 0.15:
            raise BuildError(f"figma {fid}: the click ({click:.2f}) must land between the select ({a:.2f}) and 0.15 s before it goes ({b:.2f})")
        size = min(size, int(880 / max(1, 0.56 * len(text))))
        show = a if text_from is None else text_from
        self.block(show - 0.05, b)
        self.guard(f"figma {fid}", (40, top - 80, W - 80, 160), show, b)
        s = f"#{fid}"
        if text_from is None:
            self.ft(s, {"autoAlpha": 0}, {"autoAlpha": 1, "duration": 0.08}, a - 0.04)
            self.ft(f"{s} .ftext", {"autoAlpha": 0, "filter": "blur(10px)"}, {"autoAlpha": 1, "filter": "blur(0px)", "duration": 0.18}, a)
        else:
            self.st(s, {"autoAlpha": 1}, text_from)
        self.ft(f"{s} .fsel", {"scaleX": 0.6, "autoAlpha": 0}, {"scaleX": 1, "autoAlpha": 1, "duration": 0.18, "ease": "power3.out"}, a - 0.04)
        self.ft(f"{s} .fguide", {"scaleX": 0}, {"scaleX": 1, "duration": 0.3, "ease": "power2.out"}, a)
        self.ft(f"{s} .cursor", {"x": 260, "y": 260, "autoAlpha": 0}, {"x": 0, "y": 0, "autoAlpha": 1, "duration": r3(max(0.18, click - a - 0.05)), "ease": "power3.out"}, a)
        self.tween(f"{s} .cursor", {"scale": 1}, {"scale": 0.82, "duration": 0.06, "yoyo": True, "repeat": 1}, click)
        self.sound("tick-1", a, f"{fid} select")
        self.sound("click-1", click, f"{fid} click")
        body = esc(text)
        if mode == "reject":
            self.ft(f"{s} .strike", {"scaleX": 0}, {"scaleX": 1, "duration": 0.16, "ease": "power2.out"}, click + 0.05)
            self.tween(f"{s} .ftext", {"opacity": 1}, {"opacity": 0.4, "duration": 0.15}, click + 0.12)
            body += '<b class="strike"></b>'
        elif mode == "delete":
            n = len(text)
            dd = min(0.045, max(0.025, (b - click - 0.3) / max(1, n)))
            body = "".join(f'<i class="fc">{esc(c)}</i>' for c in text) + '<i class="fcaret"></i>'
            for k in range(n):
                self.st(f"{s} .fc:nth-child({n - k})", {"display": "none"}, click + 0.08 + k * dd)
            self.sound("tech-keyboard-burst", click + 0.06, f"{fid} delete", maxlen=max(0.3, n * dd))
        elif mode != "focus":
            raise BuildError(f"{fid}: mode focus | reject | delete")
        self.tween(s, {"autoAlpha": 1, "scale": 1}, {"autoAlpha": 0, "scale": 0.96, "duration": 0.12}, b - 0.12)
        self.beat(fid, "figma", a, b, f"figma {mode} «{text}»", keys=[click + 0.1])
        lbl = "Текст" if self.RU else "Text"
        self.H["fig"].append(f'<div id="{fid}" class="figma" data-mode="{mode}" style="top:{top}px"><div class="fguide top"></div><div class="fguide bot"></div>'
                             f'<div class="fwrap"><div class="fbox"><div class="fsel"><span class="flabel">{lbl}</span><i class="h tl"></i><i class="h tr"></i>'
                             f'<i class="h bl"></i><i class="h br"></i></div><span class="ftext" style="font-size:{size}px">{body}</span>{CURSOR}</div></div></div>')
        return s

    def pen(self, pid, word, t0, b, dur=None, size=210, top=1150):
        """the Markup pen writes the signature word (Marck Script) on the chest, the Markup tool bar under it"""
        if b - t0 < 0.6:
            raise BuildError(f"pen {pid}: «{word}» needs >= 0.6 s on screen ({t0:.2f}-{b:.2f})")
        dur = round(min(dur or min(0.9, max(0.5, 0.3 + 0.06 * len(word))), b - t0 - 0.25), 2)
        size = min(size, int(980 / max(1, 0.47 * len(word))))
        wpx = int(len(word) * 0.47 * size)
        self.block(t0 - 0.3, b)
        self.guard(f"pen {pid}", (60, top, W - 120, 290), t0, b)
        s = f"#{pid}"
        self.ft(f"{s}bar", {"autoAlpha": 0, "y": 160}, {"autoAlpha": 1, "y": 0, "duration": 0.24, "ease": "power3.out"}, t0 - 0.28)
        self.st(s, {"autoAlpha": 1}, t0 - 0.02)
        self.ft(f"{s} .sw", {"clipPath": "inset(0% 100% 0% 0%)"}, {"clipPath": "inset(0% 0% 0% 0%)", "duration": dur, "ease": "none"}, t0)
        self.ft(f"{s} .nib", {"x": -wpx // 2, "autoAlpha": 1}, {"x": wpx // 2, "autoAlpha": 1, "duration": dur, "ease": "none"}, t0)
        self.ft(f"{s} .nib svg", {"y": 0}, {"y": -24, "duration": r3(dur / 8), "yoyo": True, "repeat": 7, "ease": "sine.inOut"}, t0)
        self.hide(f"{s} .nib", t0 + dur + 0.04, 0.12)
        self.hide(s, b - 0.15, 0.15)
        self.hide(f"{s}bar", b - 0.15, 0.15)
        self.sound("pencil-write", t0, f"{pid} pen", maxlen=dur + 0.2)
        self.beat(pid, "pen", t0 - 0.3, b, f"pen «{word}»", keys=[min(t0 + dur + 0.1, b - 0.2)])
        a = self.acc
        self.H["pen"].append(f'<div id="{pid}" class="mk" style="top:{top}px"><span class="sw" style="font-size:{size}px">{esc(word)}</span>'
                             f'<div class="nib"><svg width="70" height="150" viewBox="0 0 70 150"><path d="M20 0 h30 v110 l-15 36 l-15 -36 z" fill="#fff" stroke="#111" stroke-width="3"/>'
                             f'<path d="M28 132 l7 14 l7 -14 z" fill="{a}"/></svg></div></div>'
                             f'<div id="{pid}bar" class="mkbar"><i style="background:#1C1C1E"></i><i class="on" style="background:{a}"></i><i style="background:#0A84FF"></i>'
                             f'<i style="background:#D1D1D6"></i><i style="background:#FF6B6B"></i></div>')
        return s

    def hero(self, cid, a, b, hero, sub="", top=1130, snd="pop-3"):
        """a big hero card on the chest («7» / «kids»): a number or one word, a thin italic line under it"""
        self.block(a - 0.03, b)
        self.guard(f"hero {cid}", (60, top, W - 120, 330), a, b)
        s = f"#{cid}"
        self.ft(s, {"autoAlpha": 0, "scale": 0.8, "filter": "blur(16px)"}, {"autoAlpha": 1, "scale": 1, "filter": "blur(0px)", "duration": 0.26, "ease": "power3.out"}, a)
        self.tween(s, {"autoAlpha": 1, "filter": "blur(0px)"}, {"autoAlpha": 0, "filter": "blur(10px)", "duration": 0.12}, b - 0.12)
        self.sound(snd, a, f"{cid} hero")
        self.beat(cid, "hero", a, b, f"hero {hero} {sub}".strip())
        self.H["hero"].append(f'<div id="{cid}" class="xl" style="top:{top}px"><span class="hero">{hero}</span><span class="sub">{sub}</span></div>')
        return s

    # ---------------------------------------------------------------- sampled @lamdiphuc 0-5 s grammar
    def text_top(self, a, b, height, preferred):
        """Place a text row in a face-clear safe band for its actual time window."""
        zones = self.zones(a, b)
        for name in ("chest", "top"):
            _, y, _, available = zones[name]
            if available >= height:
                return int(max(y, min(preferred, y + available - height)))
        raise BuildError(f"no face-clear {height}px text band at {a:.2f}-{b:.2f} s")

    def talk_line(self, oid, text, a, b, top=None, color="white", size=90, allow_overlap=False):
        """Short, heavy sans words over the speaker's chest. Use exact spoken words; 1-3 words per beat."""
        if not text.strip() or not 0 <= a < b <= self.T or b - a < 0.18:
            raise BuildError(f"talk_line {oid}: invalid text or time")
        if color not in ("white", "yellow"):
            raise BuildError(f"talk_line {oid}: color white or yellow")
        top = int(top if top is not None else self.text_top(a, b, 130, min(1450, max(1080, self.chin + 70))))
        size = min(int(size), int(840 / max(1, .55 * len(text))))
        self.guard(f"talk_line {oid}", (110, top, 860, 130), a, b)
        self.block(max(0, a - .04), min(self.T, b + .04))
        self.overs.append((oid, r3(a), r3(b), "talk", "word"))
        selector = f"#{oid}"
        if a < .05:
            self.st(selector, {"autoAlpha": 1, "filter": "blur(0px)"}, 0)
        else:
            self.ft(selector, {"autoAlpha": 0, "y": 8, "filter": "blur(5px)"},
                    {"autoAlpha": 1, "y": 0, "filter": "blur(0px)", "duration": .12, "ease": "power2.out"}, a)
        if b < self.T - .02:
            self.st(selector, {"autoAlpha": 0}, b)
        self.beat(oid, "talk", a, b, text)
        overlap = ' data-layout-allow-overlap' if allow_overlap else ''
        self.H["chest"].append(f'<div id="{esc(oid)}" class="co-talk co-{color}"{overlap} style="top:{top}px;font-size:{max(48, size)}px">{esc(text)}</div>')
        return selector

    def handwritten(self, oid, text, a, b, position="chest", color="yellow", top=None, size=140, variant=None, pointer=False, allow_overlap=False):
        """Spoken keyword: yellow elegant script, yellow rough chalk, or white marker. Optional pointer accompanies an upper note."""
        if not text.strip() or not 0 <= a < b <= self.T or b - a < .3:
            raise BuildError(f"handwritten {oid}: invalid text or time")
        if position not in ("chest", "upper") or color not in ("white", "yellow"):
            raise BuildError(f"handwritten {oid}: position chest/upper, color white/yellow")
        variant = variant or ("script" if color == "yellow" else "marker")
        if variant not in ("script", "chalk", "marker") or (variant == "marker") != (color == "white"):
            raise BuildError(f"handwritten {oid}: use yellow script/chalk or white marker")
        face = self.face_box()
        top = int(top if top is not None else (max(80, int(face[1]) - 210) if position == "upper" else self.text_top(a, b, 180, min(1440, max(1110, self.chin + 85)))))
        size = min(int(size), int(860 / max(1, .52 * len(text))))
        self.guard(f"handwritten {oid}", (100, top, 880, 180), a, b)
        # This is the on-screen wording for the phrase, including upper labels:
        # suppress the automatic chest captions while it is visible.
        self.block(max(0, a - .04), min(self.T, b + .04))
        self.overs.append((oid, r3(a), r3(b), position, "write"))
        selector = f"#{oid}"
        self.st(selector, {"autoAlpha": 1}, a)
        self.ft(selector + " .co-script-ink", {"clipPath": "inset(0 100% 0 0)"},
                {"clipPath": "inset(0 0% 0 0)", "duration": min(.35, (b - a) * .55), "ease": "power2.out"}, a)
        if b < self.T - .02:
            self.st(selector, {"autoAlpha": 0}, b)
        self.beat(oid, "write", a, b, text)
        hand = ('<svg class="co-pointer" viewBox="0 0 120 120" aria-hidden="true"><path d="M22 110 C15 93 10 76 19 71 C24 68 30 71 39 82 L39 24 C39 12 53 12 53 24 L53 64 C59 52 69 54 72 65 C78 54 89 59 89 71 C98 64 108 73 105 84 L98 110 Z" fill="#f6dfc8" stroke="#fff" stroke-width="5" stroke-linejoin="round"/></svg>'
                if pointer and position == "upper" and face[1] > 360 else '')
        overlap = ' data-layout-allow-overlap' if allow_overlap else ''
        self.H["top" if position == "upper" else "chest"].append(
            f'<div id="{esc(oid)}" class="co-script co-{color} co-{variant} co-{position}"{overlap} style="top:{top}px;font-size:{max(55, size)}px">{hand}<span class="co-script-ink">{esc(text)}<i></i></span></div>')
        return selector

    def number_line(self, oid, number, words, a, b, top=None):
        """A spoken number in yellow handwriting followed by a short bold white phrase at chest height."""
        if not number.strip() or not words.strip() or not 0 <= a < b <= self.T or b - a < .3:
            raise BuildError(f"number_line {oid}: invalid text or time")
        top = int(top if top is not None else self.text_top(a, b, 165, min(1450, max(1090, self.chin + 75))))
        self.guard(f"number_line {oid}", (120, top, 840, 165), a, b)
        self.block(max(0, a - .04), min(self.T, b + .04))
        self.overs.append((oid, r3(a), r3(b), "number", "mixed"))
        selector = f"#{oid}"
        self.ft(selector, {"autoAlpha": 0, "scale": .94}, {"autoAlpha": 1, "scale": 1, "duration": .14, "ease": "power2.out"}, a)
        if b < self.T - .02:
            self.st(selector, {"autoAlpha": 0}, b)
        self.beat(oid, "number", a, b, f"{number} {words}")
        self.H["chest"].append(f'<div id="{esc(oid)}" class="co-number" style="top:{top}px"><span>{esc(number)}</span><b>{esc(words)}</b></div>')
        return selector

    def layered_words(self, oid, parts, b, top=None, layout="stack"):
        """Reveal 2-4 spoken runs and HOLD them together. Each part: {text, at, style: bold|script|chalk|marker, zone: chest|upper}; layout stack|paired."""
        if not isinstance(parts, list) or not 2 <= len(parts) <= 4 or not 0 < b <= self.T:
            raise BuildError(f"layered_words {oid}: needs 2-4 parts and a valid common end")
        if any(not isinstance(part, dict) or not isinstance(part.get("text"), str) or not part["text"].strip()
               or part.get("style") not in ("bold", "script", "chalk", "marker") or part.get("zone", "chest") not in ("chest", "upper")
               or not isinstance(part.get("at"), (int, float)) for part in parts):
            raise BuildError(f"layered_words {oid}: each part needs spoken text, at, style and optional zone")
        starts = [float(part["at"]) for part in parts]
        if any(not 0 <= at < b - .18 for at in starts) or any(next_at <= at for at, next_at in zip(starts, starts[1:])):
            raise BuildError(f"layered_words {oid}: part onsets must increase and leave a visible hold")
        if len({part["style"] for part in parts}) < 2:
            raise BuildError(f"layered_words {oid}: use at least two typographic roles from the reference")
        if layout not in ("stack", "paired"):
            raise BuildError(f"layered_words {oid}: layout stack or paired")
        chest = [part for part in parts if part.get("zone", "chest") == "chest"]
        if len(chest) > 3 or sum(part.get("zone") == "upper" for part in parts) > 1:
            raise BuildError(f"layered_words {oid}: at most one upper line and three chest lines")
        if layout == "paired" and len(chest) != 2:
            raise BuildError(f"layered_words {oid}: paired layout needs two chest runs")
        base = int(top if top is not None else (min(1370, max(1200, self.chin + 170)) if layout == "paired"
                                             else min(1320, max(1070, self.chin + 95))))
        row = 0
        for index, part in enumerate(parts):
            pid, at, kind = f"{oid}-{index}", starts[index], part["style"]
            zone = part.get("zone", "chest")
            if zone == "upper":
                if kind == "bold":
                    raise BuildError(f"layered_words {oid}: upper handwriting needs script or marker")
                self.handwritten(pid, part["text"], at, b, position="upper", color="white" if kind == "marker" else "yellow", size=120,
                                 variant=kind, pointer=kind == "marker")
                continue
            y = base + row * (98 if layout == "paired" else 172)
            row += 1
            if kind == "bold":
                self.talk_line(pid, part["text"], at, b, top=y, size=92, allow_overlap=layout == "paired")
            else:
                self.handwritten(pid, part["text"], at, b, position="chest", color="white" if kind == "marker" else "yellow",
                                 top=y, size=130 if kind == "script" else 112, variant=kind, allow_overlap=layout == "paired")
        return f"#{oid}-0"

    def black_statement(self, sid, a, b, lines, highlight=1):
        """Hard-cut black idea slide: 2-4 exact spoken lines, one warm yellow line, sparse fixed dust specks."""
        if not isinstance(lines, list) or not 2 <= len(lines) <= 4 or any(not isinstance(line, str) or not line.strip() for line in lines):
            raise BuildError(f"black_statement {sid}: supply 2-4 spoken lines")
        if not 0.1 <= a < b <= self.T or b - a < .7 or b - a > 2.5 or not 0 <= highlight < len(lines):
            raise BuildError(f"black_statement {sid}: invalid timing or highlight")
        self.full_screen(sid, a, b, "black statement", cap=2.5)
        self.scenes.append((sid, r3(a), r3(b), "cut", "cut"))
        self.block(max(0, a - .04), min(self.T, b + .04))
        selector = f"#{sid}"
        self.st(selector, {"autoAlpha": 1}, a)
        if b < self.T - .02:
            self.st(selector, {"autoAlpha": 0}, b)
        self.beat(sid, "statement", a, b, " / ".join(lines))
        rows = []
        for i, line in enumerate(lines):
            row_id = f"{sid}-line{i}"
            try:
                onset = max(a, min(b - .16, self.t(line, after=a)))
            except BuildError:
                onset = a + i * min(.35, (b - a) / len(lines))
            self.ft(f"#{row_id}", {"autoAlpha": 0, "y": 24, "filter": "blur(7px)"},
                    {"autoAlpha": 1, "y": 0, "filter": "blur(0px)", "duration": .28, "ease": "power2.out"}, onset)
            rows.append(f'<div id="{esc(row_id)}" class="co-statement-row {"is-yellow" if i == highlight else ""}" style="font-size:{max(58, min(84, int(850 / max(1, .52 * len(line)))))}px">{esc(line)}</div>')
        self.ft(f"#{sid} .co-statement-light", {"y": -320}, {"y": 1920, "duration": b - a, "ease": "none"}, a)
        self.H["scene"].append(f'<div id="{esc(sid)}" class="co-statement scn" data-in="cut" data-out="cut"><i class="co-statement-light"></i><div class="co-statement-lines">{"".join(rows)}</div><i class="co-dust d1"></i><i class="co-dust d2"></i><i class="co-dust d3"></i></div>')
        return selector

    # ---------------------------------------------------------------- captions (word cards)
    def card_text(self, ch):
        t = " ".join(w["text"] for w in ch).strip(" .!")
        t = re.sub(r"(?<![а-яё])ии(?![а-яё])", "ИИ", t)
        for a, b in self.card_fix.items():
            t = t.replace(a, b)
        return t

    def captions(self, special=None, quote=(), breaks=(), maxw=3, gap=0.2, max_chars=22):
        """word cards on the chest, blocked under every scene, chest card, figma box, pen and hero (and R.block()).
        special: {R.key(word): {"kind": "qt" | "it" | "xl" | "m" | "s", "opts": (a, b, c) for qt (the middle one is
        tapped), "sub": "..." for xl, "n": words in the card, "text": the card's text}}. quote: [(a, b)] cards in italic.
        breaks: words that start a new card. Cards are 1..maxw words, never end on a preposition (DP)."""
        special = special or {}
        ws, T = self.words, self.T
        brk = {norm(x) for x in breaks}

        def blocked_word(w):
            return any(w["s"] < b and w["e"] > a for a, b in self.busy)

        units, cur, k = [], [], 0

        def close():
            nonlocal cur
            if cur:
                units.append(("p", cur))
            cur = []

        while k < len(ws):
            w = ws[k]
            if blocked_word(w):
                close(); k += 1
                continue
            key = round(w["s"], 2)
            if key in special:
                close()
                n = special[key].get("n", 1)
                units.append(("f", ws[k:k + n])); k += n
                continue
            if w["n"] in brk:
                close()
            cur.append(w)
            nx = ws[k + 1] if k + 1 < len(ws) else None
            if (nx is None or nx["s"] - w["e"] > gap or w["raw"][-1] in ",.?!:–»"
                    or (nx["raw"][:1].isupper() and not nx["raw"].isupper() and nx["n"] not in self.proper)):
                close()
            k += 1
        close()

        def cost(ch):
            txt = " ".join(x["text"] for x in ch)
            c = {1: 1.6, 2: 0.2, 3: 0.0}.get(len(ch), 9)
            if ch[-1]["n"] in FUNC:
                c += 6
            if ch[0]["n"] in FUNC - {"не", "это"}:
                c -= 0.4
            if len(txt) > max_chars:
                c += 2 + (len(txt) - max_chars) * 0.2
            return c

        chunks = []
        for kind, ph in units:
            if kind == "f" or len(ph) <= 1:
                chunks.append(ph)
                continue
            n = len(ph)
            best, prev = [0.0] + [1e9] * n, [0] * (n + 1)
            for j in range(1, n + 1):
                for L in range(1, min(maxw, j) + 1):
                    c = best[j - L] + cost(ph[j - L:j])
                    if c < best[j]:
                        best[j], prev[j] = c, j - L
            cuts, j = [], n
            while j > 0:
                cuts.append((prev[j], j)); j = prev[j]
            chunks += [ph[i0:i1] for i0, i1 in reversed(cuts)]
        out = []
        for i, ch in enumerate(chunks):
            a = ch[0]["s"]
            nxt = chunks[i + 1][0]["s"] if i + 1 < len(chunks) else T + 1
            b = min(nxt - 0.02, ch[-1]["e"] + 0.45, T)
            b = min([b] + [x0 for x0, _ in self.busy if x0 > a])
            if b <= a + .02:
                continue
            sp = special.get(round(a, 2), {})
            out.append((sp.get("text") or self.card_text(ch), r3(a), r3(b), sp))
        html = []
        for i, (txt, a, b, sp) in enumerate(out):
            cid, kind, n = f"cap{i}", sp.get("kind"), len(txt)   # cap*: a reel's own ids never start with "cap"
            size = kind if kind in ("m", "s") else ("m" if n <= 11 else ("s" if n <= 20 else "xs"))
            q = " q" if any(qa <= a <= qb for qa, qb in quote) else ""
            st = ""
            if size == "xs" and n * 0.52 * 64 > 940:
                st = f' style="font-size:{max(48, int(940 / (0.52 * n)))}px"'
            if kind == "it":
                html.append(f'<div id="{cid}" class="card it">{esc(txt)}</div>')
            elif kind == "xl":
                html.append(f'<div id="{cid}" class="card xl"><div class="hero">{esc(txt)}</div><div class="sub">{esc(sp.get("sub", ""))}</div></div>')
                self.ft(f"#{cid} .sub", {"autoAlpha": 0, "y": 18}, {"autoAlpha": 1, "y": 0, "duration": 0.22}, a + sp.get("sub_at", 0.25))
            elif kind == "qt":
                html.append(f'<div id="{cid}" class="card {size}{q}"{st}>{esc(txt)}</div><div id="{cid}q" class="qt">'
                            + "".join(f"<span>{esc(o)}</span>" for o in sp["opts"]) + "</div>")
                self.ft(f"#{cid}q", {"autoAlpha": 0, "y": 30}, {"autoAlpha": 1, "y": 0, "duration": 0.16}, a - 0.34)
                self.ft(f"#{cid}q span:nth-child(2)", {"backgroundColor": "rgba(255,255,255,0)"}, {"backgroundColor": "rgba(255,255,255,0.95)", "duration": 0.08}, a - 0.07)
                self.ft(f"#{cid}q span:nth-child(2)", {"y": 0, "scale": 1}, {"y": -150, "scale": 1.25, "autoAlpha": 0, "duration": 0.2, "ease": "power2.in"}, a - 0.02)
                self.hide(f"#{cid}q", a + 0.2, 0.1)
                self.sound("tick-1", a - 0.3, f"QuickType {txt}")
                self.beat(cid, "qt", a - 0.34, b, f"QuickType «{txt}»", keys=[a - 0.05, a + 0.15])
            else:
                html.append(f'<div id="{cid}" class="card {size}{q}"{st}>{esc(txt)}</div>')
            if a < 0.1:          # frame 1 is the cover: the hook words are already there, crisp
                self.st(f"#{cid}", {"autoAlpha": 1, "scale": 1, "filter": "blur(0px)"}, 0)
            else:
                self.ft(f"#{cid}", {"autoAlpha": 0, "y": 7, "filter": "blur(5px)"},
                        {"autoAlpha": 1, "y": 0, "filter": "blur(0px)", "duration": 0.12, "ease": "power2.out"}, a - 0.02)
            self.tween(f"#{cid}", {"autoAlpha": 1}, {"autoAlpha": 0, "duration": 0.06}, max(a + 0.18, b - 0.06))
        self.caps = out
        return html

    # ---------------------------------------------------------------- build
    def _fonts_css(self):
        d = os.path.join(self.P, "assets", "fonts")
        css = os.path.join(d, "fonts-local.css")
        legacy = open(css).read().replace("url(", "url(assets/fonts/") if os.path.exists(css) else ""
        vietnamese = os.path.join(self.P, "assets", "vietnamese-fonts.css")
        return legacy + "\n" + (open(vietnamese, encoding="utf8").read() if os.path.exists(vietnamese) else "")

    def checks(self):
        """Clean OS budgets on top of the base ones: frame 1 the speaker's face, >= 1.5 s of face between scenes, OS time"""
        errs, sc = [], sorted(self.scenes, key=lambda s: s[1])
        for (i0, a0, b0, *_), (i1, a1, b1, *_) in zip(sc, sc[1:]):
            if a1 - b0 < 1.5:
                errs.append(f"only {a1 - b0:.2f} s of face between scenes {i0} and {i1} (>= 1.5 s)")
        iv = sorted([(a, b) for _, a, b, *_ in self.scenes] + [(a, b) for _, a, b, *_ in self.overs])
        tot, cur = 0.0, None
        for a, b in iv:
            if cur and a <= cur[1]:
                cur[1] = max(cur[1], b)
            else:
                tot += (cur[1] - cur[0]) if cur else 0.0
                cur = [a, b]
        tot += (cur[1] - cur[0]) if cur else 0.0
        os_pct = round(100 * tot / self.T, 1)
        return errs, os_pct

    def build(self, special=None, css="", music=None, music_db=-24, duck=-4, quote=(), breaks=(), maxw=3, gap=0.2,
              max_chars=22, extra_cover=(), hook="", lang=None):
        """captions, the page (index.html), build/plan.json + beats.json + sfx_events.json; fails on a broken budget"""
        import kit
        for a, b in self.shots:
            self.ft("#cam", {"scale": 1.0}, {"scale": 1 + self.push, "duration": r3(max(0.1, b - a - 0.02)), "ease": "none"}, a)
        caps = self.captions(special, quote, breaks, maxw, gap, max_chars)
        if music:
            self.music = {"id": music, "db": music_db, "duck": duck}
        audio = self._audio()
        plate = self.held_plate()
        H_ = self.H
        body = (f'<div id="cam"><video id="vplate" src="{plate}" data-start="0" data-duration="{self.T}" data-track-index="0" muted playsinline></video></div>\n'
                '<div id="shade"></div>\n' + "\n".join(H_["extra"] + caps + H_["top"] + H_["chest"] + H_["fig"] + H_["pen"] + H_["hero"]
                                                          + H_["scene"] + H_["icon"] + audio))
        page_css = HOUSE_CSS.replace("%ACC%", self.acc) + kit.CSS.replace("%ACC%", self.acc) + "\n" + css
        self._write(page_css, body, lang)
        errs, os_pct = self.checks()
        extra = {"style": "clean-os", "accent": self.acc, "hook": hook, "os_time_pct": os_pct,
                 "scenes": [{"id": i, "a": a, "b": b, "enter": e, "exit": x, "said": self.said(a, b)} for i, a, b, e, x in self.scenes],
                 "overlays": [{"id": i, "a": a, "b": b, "where": wh, "enter": e, "said": self.said(a, b)} for i, a, b, wh, e in self.overs],
                 "cards": [{"text": t, "a": a, "b": b} for t, a, b, _ in self.caps]}
        try:
            m = self.finish("clean-os", extra, extra_cover)
        except BuildError as e:
            if errs:
                raise BuildError(str(e) + "\n  " + "\n  ".join(errs))
            raise
        if errs:
            raise BuildError("BUILD FAILED (fix the generator):\n  " + "\n  ".join(errs))
        print(f"  OS time {os_pct} % | {len(self.scenes)} scenes | {len(self.overs)} overlays | {len(self.caps)} cards")
        return m

    def _write(self, css, body, lang):
        lang = lang or ("ru" if self.RU else "en")
        fonts = self._fonts_css()
        html = f"""<!doctype html>
<html lang="{lang}"><head><meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
{fonts}
html, body {{ margin: 0; background: #000; }}
#root {{ position: relative; width: {W}px; height: {H}px; overflow: hidden; }}
{css}
</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-width="{W}" data-height="{H}" data-duration="{self.T}" data-fps="{self.fps}">
{body}
</div>
<script>
  window.__timelines = window.__timelines || {{}};
  const tl = gsap.timeline({{ paused: true }});
{chr(10).join('  ' + x for x in self.base)}
{chr(10).join('  ' + x for x in self.tl)}
  window.__timelines["main"] = tl;
</script>
</body></html>
"""
        open(os.path.join(self.P, "index.html"), "w").write(html.replace("%ACC%", self.acc))


def _icon_default():
    import kit
    return kit.icon("gear", "#8E8E93")


HOUSE_CSS = """
#root { background: #000; font-family: Inter; }
#cam { position: absolute; inset: 0; transform-origin: 50% 40%; }
#cam video { position: absolute; inset: 0; width: 1080px; height: 1920px; object-fit: cover; }
#shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0) 56%, rgba(0,0,0,.28) 69%, rgba(0,0,0,.5) 100%); pointer-events: none; }
/* caption cards are direct children of #root: scoped so a reel's own .card inside a scene / widget never inherits the chest look (opacity 0, nowrap, line-height 1, the 4-layer black text-shadow) */
:where(#root) > .card { position: absolute; left: 0; right: 0; top: 1236px; height: 130px; display: flex; align-items: center; justify-content: center; white-space: nowrap;
  color: #fff; font-weight: 700; letter-spacing: -0.035em; line-height: 1; opacity: 0;
  text-shadow: 0 0 2px rgba(0,0,0,.6), 0 2px 6px rgba(0,0,0,.55), 0 6px 22px rgba(0,0,0,.5), 0 12px 48px rgba(0,0,0,.35); }
:where(#root) > .card.xs { font-size: 64px; font-weight: 650; } :where(#root) > .card.s { font-size: 76px; font-weight: 650; } :where(#root) > .card.m { font-size: 108px; }
:where(#root) > .card.q { font-style: italic; font-weight: 600; }
:where(#root) > .card.it { font-size: 150px; font-style: italic; font-weight: 700; letter-spacing: -0.045em; }
:where(#root) > .card.xl { flex-direction: column; top: 1170px; height: 300px; }
:where(#root) > .card.xl .hero { font-size: 230px; font-weight: 800; letter-spacing: -0.06em; line-height: .9; }
:where(#root) > .card.xl .sub { font-size: 58px; font-style: italic; font-weight: 400; letter-spacing: -0.01em; margin-top: 10px; opacity: 0; }
.xl { position: absolute; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; color: #fff; opacity: 0;
  text-shadow: 0 0 2px rgba(0,0,0,.5), 0 4px 10px rgba(0,0,0,.45), 0 16px 60px rgba(0,0,0,.45); }
.xl .hero { font-size: 300px; font-weight: 800; letter-spacing: -0.06em; line-height: .9; }
.xl .sub { font-size: 66px; font-style: italic; font-weight: 400; letter-spacing: -0.02em; margin-top: 4px; }
.qt { position: absolute; left: 90px; right: 90px; top: 1440px; height: 96px; display: flex; border-radius: 24px; background: rgba(210,213,219,.88); opacity: 0;
  box-shadow: 0 8px 30px rgba(0,0,0,.28); }
.qt span { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 44px; color: #111; border-radius: 18px; margin: 8px 4px; }
.figma { position: absolute; left: 0; right: 0; height: 0; opacity: 0; }
.fguide { position: absolute; left: 0; right: 0; height: 0; border-top: 2px dashed rgba(239,68,68,.8); }
.fguide.top { top: -72px; } .fguide.bot { top: 72px; }
.fwrap { position: absolute; left: 0; right: 0; top: -72px; height: 144px; display: flex; justify-content: center; }
.fbox { position: relative; height: 144px; display: flex; align-items: center; padding: 0 44px; white-space: nowrap; box-sizing: border-box; }
.fsel { position: absolute; inset: 0; background: rgba(239,68,68,.38); border: 3px solid #EF4444; opacity: 0; }
.fsel .h { position: absolute; width: 16px; height: 16px; background: #fff; border: 3px solid #EF4444; }
.h.tl { left: -11px; top: -11px; } .h.tr { right: -11px; top: -11px; } .h.bl { left: -11px; bottom: -11px; } .h.br { right: -11px; bottom: -11px; }
.flabel { position: absolute; left: -3px; top: -44px; background: #EF4444; color: #fff; font-size: 24px; font-weight: 600; padding: 4px 10px; border-radius: 4px 4px 4px 0; }
.ftext { position: relative; color: #fff; font-weight: 700; letter-spacing: -0.035em; text-shadow: 0 2px 10px rgba(0,0,0,.35); }
.ftext .fc { font-style: normal; }
.fcaret { display: inline-block; width: 6px; height: 0.9em; background: #fff; margin-left: 4px; vertical-align: -0.1em; }
.strike { position: absolute; left: -6px; right: -6px; top: 52%; height: 8px; background: #fff; transform-origin: 0 50%; }
.cursor { position: absolute; right: -40px; bottom: -58px; filter: drop-shadow(0 4px 8px rgba(0,0,0,.35)); }
.mk { position: absolute; left: 0; right: 0; height: 290px; display: flex; justify-content: center; opacity: 0; }
.mk .sw { display: block; font-family: "Patrick Hand", Caveat, cursive; color: #fff; line-height: 1.25; white-space: nowrap;
  text-shadow: 0 0 3px rgba(0,0,0,.75), 0 0 14px rgba(0,0,0,.55), 0 8px 40px rgba(0,0,0,.5); }
.mk .nib { position: absolute; left: 505px; top: 70px; opacity: 0; filter: drop-shadow(0 6px 10px rgba(0,0,0,.4)); }
.mkbar { position: absolute; left: 190px; right: 190px; top: 1600px; height: 150px; border-radius: 40px; background: rgba(250,250,250,.94); display: flex;
  align-items: flex-end; justify-content: center; gap: 46px; overflow: hidden; opacity: 0; box-shadow: 0 16px 50px rgba(0,0,0,.4); }
.mkbar i { width: 44px; height: 120px; border-radius: 22px 22px 6px 6px; margin-bottom: -40px; } .mkbar i.on { margin-bottom: -8px; }
.appw { position: absolute; width: 150px; height: 150px; }
.appi { position: absolute; display: flex; align-items: center; justify-content: center; opacity: 0; box-shadow: 0 16px 40px rgba(0,0,0,.45); }
.scn { position: absolute; inset: 0; visibility: hidden; overflow: hidden; color: #111; }
.scn.dark { color: #fff; }
.ov { position: absolute; opacity: 0; color: #111; box-sizing: border-box; }
.tw { position: absolute; opacity: 0; color: #111; box-sizing: border-box; }
.pip { background: #FAFAFA; border-radius: 44px; overflow: hidden; box-shadow: 0 24px 70px rgba(0,0,0,.45); }
.glass { background: rgba(246,246,248,.95); border-radius: 44px; box-shadow: 0 26px 70px rgba(0,0,0,.45); }
.dark { background: rgba(28,28,30,.86); color: #fff; border-radius: 44px; box-shadow: 0 26px 70px rgba(0,0,0,.45); }
.wdg { padding: 28px 34px; border-radius: 42px; background: rgba(28,28,30,.76); color: #fff; box-shadow: 0 16px 50px rgba(0,0,0,.45); }
.wdg.light { background: rgba(246,246,248,.94); color: #111; }
.wdg small { font-size: 28px; font-weight: 500; opacity: .7; letter-spacing: .01em; }
.tabnum { font-variant-numeric: tabular-nums; }
/* @lamdiphuc opening: compact bold words, handwritten yellow, hard-cut black statement. */
:where(#root) > .card { top: 1510px; height: 80px; font-family: "Playfair Display", Georgia, serif; font-size: 45px; font-weight: 400;
  letter-spacing: 0; color: #F7F6F1; text-shadow: 0 2px 9px rgba(0,0,0,.8); }
:where(#root) > .card.xs { font-size: 41px; font-weight: 400; }
:where(#root) > .card.s { font-size: 45px; font-weight: 400; }
:where(#root) > .card.m { font-size: 50px; font-weight: 400; }
.co-talk { position: absolute; left: 110px; width: 860px; height: 130px; display: flex; align-items: center; justify-content: center;
  white-space: nowrap; font-family: "Inter Tight", Inter, sans-serif; font-weight: 850; letter-spacing: -.055em; line-height: 1;
  color: #F7F6F1; opacity: 0; text-shadow: 0 3px 15px rgba(0,0,0,.7); }
.co-talk.co-yellow { color: #F7E769; }
.co-script { position: absolute; left: 100px; width: 880px; height: 180px; display: flex; align-items: center; justify-content: center;
  white-space: nowrap; font-family: "Patrick Hand", Caveat, cursive; font-weight: 400; line-height: 1; opacity: 0; }
.co-script.co-white { color: #F7F6F1; -webkit-text-stroke: 1px rgba(255,255,255,.72); text-shadow: 0 0 6px rgba(255,255,255,.75), 0 4px 14px rgba(0,0,0,.65); }
.co-script.co-yellow { color: #F7E769; text-shadow: 0 2px 5px rgba(0,0,0,.8), 0 0 9px rgba(247,231,105,.28); }
.co-script.co-yellow:not(.co-chalk) { font-family: "Dancing Script", Caveat, cursive; font-weight: 500; }
.co-script.co-yellow.co-chalk { font-family: Caveat, "Patrick Hand", cursive; font-weight: 700; -webkit-text-stroke: 1.5px #F7E769;
  text-shadow: 1px 0 rgba(247,231,105,.65), -2px 1px rgba(247,231,105,.36), 0 4px 10px rgba(0,0,0,.7); }
.co-pointer { position: absolute; width: 140px; height: 140px; left: 50%; top: -116px; transform: translateX(-50%) rotate(12deg);
  filter: drop-shadow(0 3px 8px rgba(0,0,0,.45)); }
.co-script-ink { position: relative; display: inline-block; clip-path: inset(0 100% 0 0); }
.co-script-ink i { position: absolute; left: 10%; right: 8%; bottom: 2px; height: 4px; border-radius: 60% 30%; transform: rotate(-2deg);
  background: currentColor; opacity: 0; }
.co-script.co-upper.co-marker .co-script-ink i { opacity: .6; }
.co-number { position: absolute; left: 120px; width: 840px; height: 165px; display: flex; align-items: baseline; justify-content: center; gap: 10px;
  color: #F7F6F1; opacity: 0; text-shadow: 0 3px 15px rgba(0,0,0,.7); }
.co-number span { font: 700 138px Caveat, "Patrick Hand", cursive; color: #F7E769; -webkit-text-stroke: 1.5px #F7E769; }
.co-number b { font: 850 86px "Inter Tight", Inter, sans-serif; letter-spacing: -.055em; }
.co-statement { position: absolute; inset: 0; background: #050505; color: #F7F6F1; }
.co-statement-light { position: absolute; left: 0; top: 0; width: 1080px; height: 320px; opacity: .12;
  background: linear-gradient(180deg, transparent, #F7E769 48%, transparent); pointer-events: none; }
.co-statement-lines { position: absolute; left: 110px; top: 50%; width: 860px; transform: translateY(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 4px; }
.co-statement-row { max-width: 860px; white-space: nowrap; font-family: "Inter Tight", Inter, sans-serif;
  font-weight: 850; line-height: 1.08; letter-spacing: -.055em; text-align: center; }
.co-statement-row.is-yellow { color: #F7E769; }
.co-dust { position: absolute; display: block; width: 3px; height: 3px; background: #aaa; opacity: .24; border-radius: 50%; }
.co-dust.d1 { left: 26%; top: 18%; } .co-dust.d2 { left: 83%; top: 53%; } .co-dust.d3 { left: 44%; top: 81%; }
"""


def api():
    """print the builder + kit API: signatures and the first paragraph of each docstring"""
    import kit
    print(__doc__.split("\n\nProject")[0])
    for mod, objs in (("CleanOS", [CleanOS]), ("kit", [kit])):
        print(f"\n== {mod}")
        for obj in objs:
            for name, fn in inspect.getmembers(obj, inspect.isfunction):
                if name.startswith("_") or (obj is kit and fn.__module__ != "kit") or (obj is CleanOS and name not in CleanOS.__dict__ and name not in (
                        "t", "said", "ft", "st", "tween", "sound", "insert", "beat", "js", "guard", "zones", "face_box")):
                    continue
                doc = (inspect.getdoc(fn) or "").split("\n\n")[0].replace("\n", " ")
                print(f"  {name}{inspect.signature(fn)}\n      {doc}")


from facereel import new_project  # noqa: E402,F401  (the shared project maker; --new below)


if __name__ == "__main__":
    if "--api" in sys.argv:
        api()
    elif "--new" in sys.argv:
        i = sys.argv.index("--new")
        new_project(sys.argv[i + 1], sys.argv[sys.argv.index("--from") + 1])
    else:
        print(__doc__)
