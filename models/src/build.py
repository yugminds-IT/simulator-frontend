"""Build kit models in Blender (headless) -> models/<id>.blend + models/<id>.glb + manifest.json.

Run:  npm run models               (all)
      npm run models -- esp32 oled (some)

Conventions: geometry in mm, Blender Z up (exported as glTF Y up), origin = bottom-centre of
the PCB/body, root node `<id>` scaled 0.001 so the .glb is in metres. +Y (Blender) = "top" edge
of the board in top view (exported as -Z). Every part is a named node `<id>_<part>`; label
anchors are empties `anchor_<id>_<part>`.
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Matrix, Vector

MODELS_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = 2.54  # header pitch
T = 1.6   # PCB thickness — TODO confirm (EasyEDA default)

# name: (linear RGBA, metallic, roughness)
PALETTE = {
    'pcb_black': ((0.02, 0.02, 0.022, 1), 0, 0.55),
    'pcb_blue': ((0.006, 0.025, 0.14, 1), 0, 0.5),
    'pcb_red': ((0.45, 0.02, 0.015, 1), 0, 0.5),
    'pcb_yellow': ((0.6, 0.45, 0.08, 1), 0.2, 0.45),
    'plastic_black': ((0.015, 0.015, 0.015, 1), 0, 0.7),
    'plastic_white': ((0.88, 0.87, 0.82, 1), 0, 0.5),
    'plastic_yellow': ((1.0, 0.64, 0.0, 1), 0, 0.42),
    'plastic_blue': ((0.05, 0.25, 0.75, 1), 0, 0.5),
    'plastic_lightblue': ((0.25, 0.55, 0.75, 1), 0, 0.6),
    'plastic_grey': ((0.35, 0.35, 0.37, 1), 0, 0.6),
    'metal': ((0.7, 0.7, 0.72, 1), 1, 0.35),
    'gold': ((0.85, 0.6, 0.25, 1), 1, 0.3),
    'copper': ((0.7, 0.35, 0.15, 1), 1, 0.4),
    'chip': ((0.03, 0.03, 0.03, 1), 0, 0.45),
    'smd_tan': ((0.55, 0.38, 0.2, 1), 0, 0.6),
    'screen': ((0.004, 0.004, 0.006, 1), 0, 0.6),
    'glass': ((0.6, 0.6, 0.6, 1), 0, 0.1),
    'led_red': ((0.8, 0.02, 0.02, 1), 0, 0.25),
    'led_yellow': ((0.9, 0.7, 0.02, 1), 0, 0.25),
    'led_green': ((0.05, 0.7, 0.08, 1), 0, 0.25),
    'led_blue': ((0.02, 0.15, 0.9, 1), 0, 0.25),
    'led_clear': ((0.8, 0.8, 0.85, 1), 0, 0.1),
    'acrylic': ((0.85, 0.92, 0.98, 1), 0, 0.05),
    'acrylic_edge': ((0.9, 0.96, 1.0, 1), 0, 0.12),
    'brass': ((0.8, 0.6, 0.25, 1), 1, 0.35),
    'rim_yellow': ((1.0, 0.68, 0.0, 1), 0, 0.4),
    'cap_clear': ((0.86, 0.88, 0.9, 1), 0, 0.18),
    'bakelite': ((0.72, 0.62, 0.45, 1), 0, 0.55),
    'steel': ((0.75, 0.76, 0.78, 1), 1, 0.3),
    'mesh_steel': ((0.42, 0.43, 0.45, 1), 1, 0.55),
    'mesh_dark': ((0.05, 0.05, 0.055, 1), 0, 0.8),
    'heater': ((0.25, 0.08, 0.03, 1), 0, 0.6),
    'cds': ((0.62, 0.2, 0.04, 1), 0, 0.35),
    'led_smoke': ((0.05, 0.05, 0.07, 1), 0, 0.1),        # dark IR-filter epoxy (IR receivers); led_* = glassy epoxy on the site
    'servo_blue': ((0.06, 0.16, 0.85, 1), 0, 0.25),   # translucent case (opacity set by the site)
    'nylon': ((0.92, 0.92, 0.88, 1), 0, 0.45),
    'rubber': ((0.025, 0.025, 0.028, 1), 0, 0.85),
    'wire_red': ((0.6, 0.02, 0.02, 1), 0, 0.6),
    'wire_black': ((0.02, 0.02, 0.02, 1), 0, 0.6),
    'wire_brown': ((0.15, 0.06, 0.02, 1), 0, 0.6),
    'wire_orange': ((0.9, 0.3, 0.02, 1), 0, 0.6),
    'wire_yellow': ((0.92, 0.7, 0.05, 1), 0, 0.6),
    # Scratch lessons: the cat sprite (soft vinyl-toy look)
    'fur_orange': ((1.0, 0.42, 0.06, 1), 0, 0.7),
    'fur_cream': ((0.95, 0.82, 0.62, 1), 0, 0.75),
    'fur_dark': ((0.45, 0.13, 0.02, 1), 0, 0.7),
    'nose_pink': ((0.9, 0.3, 0.35, 1), 0, 0.45),
    'eye_white': ((0.9, 0.9, 0.92, 1), 0, 0.25),
    'eye_black': ((0.01, 0.01, 0.015, 1), 0, 0.15),
    'collar_blue': ((0.02, 0.12, 0.7, 1), 0, 0.45),
}

ID = None
ROOT = None
ANCHORS, PINS = [], []
_MESH, _MAT = {}, {}


def new(model_id):
    """Fresh empty scene + root node for one model."""
    global ID, ROOT, ANCHORS, PINS, _MESH, _MAT
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ID, ANCHORS, PINS, _MESH, _MAT = model_id, [], [], {}, {}
    ROOT = bpy.data.objects.new(model_id, None)
    ROOT.scale = (0.001, 0.001, 0.001)  # mm -> m
    bpy.context.scene.collection.objects.link(ROOT)


def mat(name):
    if name not in _MAT:
        rgba, metal, rough = PALETTE[name]
        m = bpy.data.materials.new(name)
        try:
            m.use_nodes = True
        except Exception:
            pass
        b = m.node_tree.nodes.get('Principled BSDF')
        b.inputs['Base Color'].default_value = rgba
        b.inputs['Metallic'].default_value = metal
        b.inputs['Roughness'].default_value = rough
        m.diffuse_color = rgba
        _MAT[name] = m
    return _MAT[name]


# --- primitives: tuples consumed by mesh() -----------------------------------------------
def box(c, s):
    """Box centred at c with size s (mm)."""
    return ('box', c, s)


def cyl(c, r, h, seg=16, axis='Z', r2=None):
    """Cylinder/cone centred at c, length h along axis."""
    return ('cyl', c, r, h, seg, axis, r2)


def prism(c, pts, depth):
    """2D profile [(x, z), ...] extruded along Y by `depth`, centred at c."""
    return ('prism', c, pts, depth)


def lathe(c, prof, seg=40, axis='Y', smooth=False):
    """Closed 2D profile [(radius, h), ...] revolved around the Y axis (tyres, rims, hubs) or 'Z' (upright parts) through c.
    smooth=True shades the faces smooth (round glassy parts such as LED domes)."""
    return ('lathe', c, prof, seg, axis, smooth)


def boxr(c, s, ang):
    """Box centred at c, size s, turned `ang` radians about the Y axis (wheel treads, spokes)."""
    return ('boxr', c, s, ang)


def tube(pts, r, seg=6):
    """Round wire along a 3D polyline [(x, y, z), ...] (cables), capped at both ends."""
    return ('tube', pts, r, seg)


def rrect(c, s, r, seg=4):
    """Rounded-rectangle slab centred at c, size s=(w, d, h), corner radius r."""
    return ('rrect', c, s, r, seg)


def slab(c, outline, holes=(), depth=3, plane='XY'):
    """Flat part cut from sheet (laser-cut acrylic): outline [(u, v), ...] with through-holes [[(u, v), ...], ...],
    extruded `depth` through the plane, centred at c. plane 'XY' = lying flat, 'XZ' = standing (thin along Y), 'YZ' = extruded along X."""
    return ('slab', c, outline, holes, depth, plane)


# 2D shapes for slab outlines / holes (mm)
def circle(x, y, r, seg=8):
    return [(x + r * math.cos(2 * math.pi * k / seg), y + r * math.sin(2 * math.pi * k / seg)) for k in range(seg)]


def oblong(x, y, w, h, seg=4):
    """Stadium slot w x h (w along u)."""
    r, pts = h / 2, []
    for cx, a0 in ((x + w / 2 - r, -90), (x - w / 2 + r, 90)):
        pts += [(cx + r * math.cos(math.radians(a0 + 180 * k / seg)), y + r * math.sin(math.radians(a0 + 180 * k / seg))) for k in range(seg + 1)]
    return pts


def rect(x, y, w, h):
    return [(x - w / 2, y - h / 2), (x + w / 2, y - h / 2), (x + w / 2, y + h / 2), (x - w / 2, y + h / 2)]


def plate_outline(w, d, r, notches=(), chamfer=0, seg=4):
    """Rounded rectangle (CCW) with rectangular notches cut into the long edges: notches = [(x, side ±1, width, depth)].
    chamfer > 0 cuts the two front (+x) corners at 45 degrees instead of rounding them."""
    def arc(cx, cy, a0):
        return [(cx + r * math.cos(math.radians(a0 + 90 * k / seg)), cy + r * math.sin(math.radians(a0 + 90 * k / seg))) for k in range(seg + 1)]
    def edge(side):
        out = []
        for x, sd, nw, nd in sorted((n for n in notches if n[1] == side), key=lambda n: -n[0] * side):
            y0, y1 = side * d / 2, side * (d / 2 - nd)
            a, b = (x + side * nw / 2, x - side * nw / 2)
            out += [(a, y0), (a, y1), (b, y1), (b, y0)]
        return out
    fr = [(w / 2, d / 2 - chamfer), (w / 2 - chamfer, d / 2)] if chamfer else arc(w / 2 - r, d / 2 - r, 0)
    br = [(w / 2 - chamfer, -d / 2), (w / 2, -d / 2 + chamfer)] if chamfer else arc(w / 2 - r, -d / 2 + r, 270)
    return fr + edge(1) + arc(-w / 2 + r, d / 2 - r, 90) + arc(-w / 2 + r, -d / 2 + r, 180) + edge(-1) + br


def mesh(key, prims, material):
    k = (key, material)
    if k in _MESH:
        return _MESH[k]
    bm = bmesh.new()
    for p in prims:
        if p[0] == 'box':
            _, c, s = p
            bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(c) @ Matrix.Diagonal((*s, 1)))
        elif p[0] == 'lathe':
            _, c, prof, seg, axis, smooth = p
            ring = {'Z': lambda r, h, a: (c[0] + r * math.cos(a), c[1] + r * math.sin(a), c[2] + h),
                    '-X': lambda r, h, a: (c[0] - h, c[1] + r * math.cos(a), c[2] + r * math.sin(a)),   # lying down, pointing -X
                    'Y': lambda r, h, a: (c[0] + r * math.cos(a), c[1] + h, c[2] + r * math.sin(a))}[axis]
            rings = [[bm.verts.new(ring(r, y, 2 * math.pi * k / seg)) for r, y in prof] for k in range(seg)]
            n = len(prof)
            for k in range(seg):
                a, b = rings[k], rings[(k + 1) % seg]
                for i in range(n):
                    j = (i + 1) % n
                    bm.faces.new((a[i], a[j], b[j], b[i])).smooth = smooth
        elif p[0] == 'tube':
            _, pts, r, seg = p
            rings = []
            for i, q in enumerate(pts):
                t = Vector(pts[min(i + 1, len(pts) - 1)]) - Vector(pts[max(i - 1, 0)])
                n = t.cross(Vector((0, 0, 1))).normalized()
                b = n.cross(t).normalized()
                rings.append([bm.verts.new(Vector(q) + r * (math.cos(2 * math.pi * k / seg) * n + math.sin(2 * math.pi * k / seg) * b)) for k in range(seg)])
            for a, b in zip(rings, rings[1:]):
                for k in range(seg):
                    bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k])).smooth = True
            bm.faces.new(rings[0][::-1])
            bm.faces.new(rings[-1])
        elif p[0] == 'boxr':
            _, c, sz, ang = p
            bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(c) @ Matrix.Rotation(ang, 4, 'Y') @ Matrix.Diagonal((*sz, 1)))
        elif p[0] == 'prism':
            _, c, pts, depth = p
            f = [bm.verts.new((c[0] + x, c[1] - depth / 2, c[2] + z)) for x, z in pts]
            b = [bm.verts.new((c[0] + x, c[1] + depth / 2, c[2] + z)) for x, z in pts]
            bm.faces.new(f)
            bm.faces.new(b[::-1])
            for i in range(len(pts)):
                j = (i + 1) % len(pts)
                bm.faces.new((f[i], f[j], b[j], b[i]))
        elif p[0] == 'slab':
            _, c, outline, holes, depth, plane = p
            before = set(bm.faces)
            P = {'XY': lambda u, v, w: (c[0] + u, c[1] + v, c[2] + w), 'XZ': lambda u, v, w: (c[0] + u, c[1] + w, c[2] + v),
                 'YZ': lambda u, v, w: (c[0] + w, c[1] + u, c[2] + v)}[plane]
            edges = []
            for loop in (outline, *holes):
                vs = [bm.verts.new(P(u, v, depth / 2)) for u, v in loop]
                edges += [bm.edges.new((vs[i], vs[(i + 1) % len(vs)])) for i in range(len(vs))]
            nrm = {'XY': (0, 0, 1), 'XZ': (0, 1, 0), 'YZ': (1, 0, 0)}[plane]
            faces = bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=edges, normal=nrm)['geom']
            faces = [f for f in faces if isinstance(f, bmesh.types.BMFace)]
            ext = bmesh.ops.extrude_face_region(bm, geom=faces)['geom']
            bmesh.ops.translate(bm, vec=tuple(-depth * n for n in nrm), verts=[v for v in ext if isinstance(v, bmesh.types.BMVert)])
            if material == 'acrylic':  # cut edges and hole walls get their own material (they catch the light on real acrylic)
                for f in set(bm.faces) - before:
                    f.normal_update()
                    f.material_index = int(abs(f.normal.dot(Vector(nrm))) < 0.5)
        elif p[0] == 'rrect':
            _, c, (w, d, h), r, seg = p
            pts = []
            for cx, cy, a0 in ((w / 2 - r, d / 2 - r, 0), (-w / 2 + r, d / 2 - r, 90),
                               (-w / 2 + r, -d / 2 + r, 180), (w / 2 - r, -d / 2 + r, 270)):
                for k in range(seg + 1):
                    a = math.radians(a0 + 90 * k / seg)
                    pts.append((c[0] + cx + r * math.cos(a), c[1] + cy + r * math.sin(a)))
            bot = [bm.verts.new((x, y, c[2] - h / 2)) for x, y in pts]
            top = [bm.verts.new((x, y, c[2] + h / 2)) for x, y in pts]
            bm.faces.new(bot[::-1])
            bm.faces.new(top)
            for i in range(len(pts)):
                j = (i + 1) % len(pts)
                bm.faces.new((bot[i], bot[j], top[j], top[i]))
        else:
            _, c, r, h, seg, axis, r2 = p
            rot = {'Z': Matrix.Identity(4), 'X': Matrix.Rotation(math.pi / 2, 4, 'Y'),
                   'Y': Matrix.Rotation(math.pi / 2, 4, 'X')}[axis]
            bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r,
                                  radius2=r if r2 is None else r2, depth=h,
                                  matrix=Matrix.Translation(c) @ rot)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    edges = any(f.material_index for f in bm.faces)
    me = bpy.data.meshes.new(f'{ID}_{key}')
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat(material))
    if edges:
        me.materials.append(mat(material + '_edge'))
    _MESH[k] = me
    return me


def part(name, prims, material, at=(0, 0, 0), rotz=0, key=None, parent=None):
    """Named mesh node `<id>_<name>`. Same `key` -> shared mesh data (instancing). `parent` makes moving assemblies."""
    o = bpy.data.objects.new(f'{ID}_{name}', mesh(key or name, prims, material))
    o.location = at
    o.rotation_euler = (0, 0, math.radians(rotz))
    o.parent = parent or ROOT
    bpy.context.scene.collection.objects.link(o)
    return o


def anchor(name, at, pin=False):
    """Label anchor. pin=True -> listed in manifest `pins` (label filled later from EasyEDA)."""
    o = bpy.data.objects.new(f'anchor_{ID}_{name}', None)
    o.empty_display_type = 'SPHERE'
    o.empty_display_size = 0.6
    o.location = at
    o.parent = ROOT
    bpy.context.scene.collection.objects.link(o)
    ANCHORS.append(o.name)
    if pin:
        PINS.append(o.name)


def save():
    bpy.context.preferences.filepaths.save_version = 0  # no .blend1 backups
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(MODELS_DIR, f'{ID}.blend'), compress=True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(MODELS_DIR, f'{ID}.glb'), export_format='GLB',
                              export_yup=True, export_cameras=False, export_lights=False,
                              export_extras=False)


# --- reusable sub-assemblies ---------------------------------------------------------------
def pcb(w, d, material='pcb_blue', name='pcb', holes=(), r=1.2):
    """Rounded board slab z 0..T plus optional mounting-hole rings (gold annulus, visual only)."""
    part(name, [rrect((0, 0, T / 2), (w, d, T), r)], material)
    for i, (x, y) in enumerate(holes):
        part(f'hole_{i + 1}', [cyl((0, 0, T + 0.02), 1.6, 0.04, 12)], 'gold', (x, y, 0), key='hole')
        part(f'hole_{i + 1}_bore', [cyl((0, 0, T + 0.05), 0.9, 0.06, 12)], 'plastic_black', (x, y, 0), key='hole_bore')


def male_pins_down(prefix, names, x, y0, dy=-P, spacer=True):
    """Row of male header pins hanging below the PCB (module plugs into a socket). Anchor at pad."""
    n = len(names)
    if spacer:
        part(f'{prefix}_spacer', [box((0, 0, -1.25), (2.5, n * P, 2.5))], 'plastic_black',
             (x, y0 + dy * (n - 1) / 2, 0), key=f'spacer{n}')
    for i, nm in enumerate(names):
        y = y0 + dy * i
        part(f'pin_{nm}', [box((0, 0, (-8.5 + T + 1.2) / 2), (0.64, 0.64, 8.5 + T + 1.2)),
                           cyl((0, 0, T + 0.03), 0.85, 0.06, 8), cyl((0, 0, T + 0.4), 0.75, 0.7, 6, 'Z', 0.34)], 'gold', (x, y, 0), key='pin_down')
        anchor(nm, (x, y, T + 1.2), pin=True)


def female_row(prefix, names, x, y0, dy=-P, anchor_names=True):
    """Female header (8.5 mm tall) standing on the board, pins along Y."""
    n = len(names)
    part(prefix, [box((0, 0, T + 4.25), (2.5, n * P, 8.5))], 'plastic_black', (x, y0 + dy * (n - 1) / 2, 0),
         key=f'female{n}')
    for i, nm in enumerate(names):
        y = y0 + dy * i
        part(f'{prefix}_hole_{i + 1}', [box((0, 0, T + 8.5), (0.9, 0.9, 0.04))], 'chip', (x, y, 0), key='fhole')
        if anchor_names:
            anchor(nm, (x, y, T + 8.5), pin=True)


def male_up(prefix, names, x, y0, dy=-P):
    """Male header standing up (servo / jumper style)."""
    n = len(names)
    part(prefix, [box((0, 0, T + 1.25), (2.5, n * P, 2.5))], 'plastic_black', (x, y0 + dy * (n - 1) / 2, 0),
         key=f'maleup{n}')
    for i, nm in enumerate(names):
        y = y0 + dy * i
        part(f'{prefix}_pin_{i + 1}', [box((0, 0, T + 3), (0.64, 0.64, 6))], 'gold', (x, y, 0), key='pin_up')
        anchor(nm, (x, y, T + 6), pin=True)


def xh(prefix, names, at, rotz=0, color='plastic_white', side=False):
    """JST-XH style connector, 2.54 pitch (footprint XY-XH2.54). Pins run along local X.
    side=False: vertical (opening up). side=True: right-angle, opening faces local -Y."""
    n = len(names)
    L = (n - 1) * P + 4.9
    if not side:   # housing 5.75 deep, 7.0 tall, open top
        h, d, wall = 7.0, 5.75, 0.8
        prims = [box((0, 0, T + 0.5), (L, d, 1.0)),
                 box((0, d / 2 - wall / 2, T + h / 2), (L, wall, h)),
                 box((0, -d / 2 + wall / 2, T + h / 2), (L, wall, h)),
                 box((L / 2 - wall / 2, 0, T + h / 2), (wall, d, h)),
                 box((-L / 2 + wall / 2, 0, T + h / 2), (wall, d, h))]
        prims.append(box((0, -d / 2 - 0.3, T + h - 1.5), (2.6, 0.6, 2.4)))  # latch window rib
        prims += [box((sx * (L / 2 - 1.4), -d / 2 - 0.2, T + h - 2.2), (1.2, 0.4, 3.6)) for sx in (-1, 1)]  # polarising ribs
        pin_c, pin_s, tip = (0, 0.4, T + 3.5), (0.64, 0.64, 5.5), (0, 0.4, T + 6.2)
    else:          # lying flat: 7.0 deep (Y), 5.75 tall, open toward -Y
        h, d, wall = 5.75, 7.0, 0.8  # closed box: roof over the pins, the plug slides in from the open -Y end
        prims = [box((0, d / 2 - 0.6, T + h / 2), (L, 1.2, h)),                      # back wall
                 box((0, 0, T + 0.4), (L, d, 0.8)),                                  # floor
                 box((L / 2 - wall / 2, 0, T + h / 2), (wall, d, h)),                # side walls
                 box((-L / 2 + wall / 2, 0, T + h / 2), (wall, d, h)),
                 box((L / 2 + 0.5, -d / 2 + 1.0, T + h / 2), (1.0, 2.0, h)),         # latch ears at the mating end
                 box((-L / 2 - 0.5, -d / 2 + 1.0, T + h / 2), (1.0, 2.0, h)),
                 box((0, 0, T + h - 0.4), (L, d, 0.8)),                              # roof
                 box((0, -d / 2 + 1.6, T + h + 0.15), (2.6, 2.2, 0.3))]               # latch window frame on the roof
        pin_c, pin_s, tip = (0, -0.3, T + 2.2), (0.64, 5.6, 0.64), (0, -d / 2 + 0.8, T + 2.2)
    o = part(prefix, prims, color, at, rotz, key=f'xh{n}{"s" if side else "v"}{color}')
    rm = Matrix.Rotation(math.radians(rotz), 4, 'Z')
    for i, nm in enumerate(names):
        lx = (i - (n - 1) / 2) * P
        off = rm @ Vector((lx, 0, 0))
        pos = (at[0] + off.x, at[1] + off.y, at[2])
        part(f'{prefix}_pin_{i + 1}', [box(pin_c, pin_s)], 'gold', pos, rotz, key=f'xhpin{"s" if side else "v"}')
        t = rm @ Vector((lx + tip[0], tip[1], tip[2]))
        anchor(nm, (at[0] + t.x, at[1] + t.y, t.z), pin=True)
    return o


def smd(name, at, size=(2.0, 1.25, 0.6), material='smd_tan', rotz=0):
    part(name, [box((0, 0, T + size[2] / 2), size)], material, at, rotz, key=f'smd{size}{material}')


# --- models ----------------------------------------------------------------------------------
def esp32():
    new('esp32')
    W, D = 28.2, 51.8
    pcb(W, D, 'pcb_black', 'body', holes=[(sx * 11.7, sy * 23.5) for sx in (-1, 1) for sy in (-1, 1)], r=1)
    rx = 25.4 / 2  # row spacing 1.0": from the base board's ESP32 socket (EasyEDA layout, 2026-11-21)
    left = ['3v3', 'gnd_1', 'd15', 'd2', 'd4', 'rx2', 'tx2', 'd5', 'd18', 'd19', 'd21', 'rx0', 'tx0', 'd22', 'd23']
    right = ['vin', 'gnd_2', 'd13', 'd12', 'd14', 'd27', 'd26', 'd25', 'd33', 'd32', 'd35', 'd34', 'vn', 'vp', 'en']
    male_pins_down('header_l', left, -rx, 7 * P)
    male_pins_down('header_r', right, rx, 7 * P)
    anchor('pins_left', (-rx, 0, T + 1.2))
    anchor('pins_right', (rx, 0, T + 1.2))
    # ESP32-WROOM-32: 18 x 25.5 x 3.1 (Espressif datasheet); antenna end flush with the board edge
    my = -D / 2 + 12.75
    part('module', [rrect((0, my, T + 0.4), (18, 25.5, 0.8), 0.4)], 'pcb_black')
    part('module_pads', [box((sx * 9, -1.6 - i * 1.27, T + 0.42), (0.6, 0.9, 0.86)) for sx in (-1, 1) for i in range(14)] +
         [box((-5.7 + i * 1.27, -0.6, T + 0.42), (0.9, 0.6, 0.86)) for i in range(10)], 'gold')
    part('module_shield', [rrect((0, -9.8, T + 0.8 + 1.15), (16, 17.6, 2.3), 0.5)], 'metal')
    anchor('module', (0, -9.8, T + 3.1))
    ya, za = -D / 2 + 3.4, T + 0.82  # PCB antenna meander (shape from render)
    meander = [box((x, ya, za), (0.55, 4.6, 0.04)) for x in range(-6, 7, 2)]
    meander += [box((x + 1, ya + (2.05 if i % 2 == 0 else -2.05), za), (2.55, 0.55, 0.04)) for i, x in enumerate(range(-6, 6, 2))]
    part('antenna', meander, 'gold')
    anchor('antenna', (0, ya, T + 0.84))
    # micro-USB B receptacle (shell profile from the render; 7.5 x 5.6 x 2.5)
    usb = [(-3.75, 0), (3.75, 0), (3.75, 1.75), (3.0, 2.5), (-3.0, 2.5), (-3.75, 1.75)]
    part('usb', [prism((0, D / 2 - 2.8, T), usb, 5.6), box((-4.1, D / 2 - 3.5, T + 0.35), (0.7, 2.2, 0.7)), box((4.1, D / 2 - 3.5, T + 0.35), (0.7, 2.2, 0.7))], 'metal')
    part('usb_port', [prism((0, D / 2 + 0.02, T), [(x * 0.82, 0.35 + z * 0.7) for x, z in usb], 0.04)], 'chip')
    anchor('usb', (0, D / 2, T + 1.25))
    for nm, x in (('btn_boot', -7.8), ('btn_en', 7.8)):  # SMD tact switches, BOOT left / EN right of the USB
        part(nm, [box((0, 0, T + 0.4), (4.2, 3.2, 0.8)), box((0, 0, T + 0.95), (4.2, 3.2, 0.3))] +
             [box((sx * 2.4, sy * 1.0, T + 0.2), (0.6, 0.5, 0.4)) for sx in (-1, 1) for sy in (-1, 1)], 'metal', (x, 21.2, 0), key='btn')
        part(f'{nm}_cap', [box((0, 0, T + 1.4), (1.6, 1.2, 0.6))], 'plastic_black', (x, 21.2, 0), key='btn_cap')
        anchor(nm, (x, 21.2, T + 1.7))
    # USB-UART bridge (QFN 5x5) and 3.3 V regulator (SOT-223)
    part('usb_uart', [box((0, 0, T + 0.45), (5, 5, 0.9))], 'chip', (-5, 13, 0))
    part('usb_uart_pads', [box((sx * 2.65, (i - 1.5) * 1.0, T + 0.1), (0.3, 0.5, 0.2)) for sx in (-1, 1) for i in range(4)] +
         [box(((i - 1.5) * 1.0, sy * 2.65, T + 0.1), (0.5, 0.3, 0.2)) for sy in (-1, 1) for i in range(4)], 'metal', (-5, 13, 0))
    part('regulator', [box((0, 0, T + 0.8), (6.5, 3.5, 1.6))], 'chip', (5, 12, 0))
    part('regulator_legs', [box((x, -2.4, T + 0.15), (0.7, 1.6, 0.3)) for x in (-2.3, 0, 2.3)] + [box((0, 2.4, T + 0.15), (3.2, 1.6, 0.3))], 'metal', (5, 12, 0))
    anchor('usb_uart', (-5, 13, T + 0.9))
    anchor('regulator', (5, 12, T + 1.6))
    # passives: bodies + metal end caps
    caps = [(-7.5, 7.8, 0), (-5, 7.8, 0), (-2.5, 7.8, 0), (0, 7.8, 0), (2.5, 7.8, 0), (5, 7.8, 0), (7.5, 7.8, 0), (9.2, 9, 90), (9.2, 15, 90), (0.5, 16.5, 0), (-9.2, 12, 90), (-1, 2.8, 0)]
    body, ends = [], []
    for x, y, r in caps:
        lx, ly = (1.6, 0.8) if r == 0 else (0.8, 1.6)
        body.append(box((x, y, T + 0.25), (lx * 0.6 if r == 0 else lx, ly if r == 0 else ly * 0.6, 0.5)))
        for k in (-1, 1):
            ends.append(box((x + (k * 0.6 if r == 0 else 0), y + (0 if r == 0 else k * 0.6), T + 0.25), (0.4 if r == 0 else 0.8, 0.8 if r == 0 else 0.4, 0.5)))
    part('passives', body, 'smd_tan')
    part('passive_ends', ends, 'metal')
    smd('led_gpio2', (-4, 5, 0), (2.0, 1.25, 0.7), 'led_blue')
    smd('led_power', (4, 5, 0), (2.0, 1.25, 0.7), 'led_red')
    anchor('led_gpio2', (-4, 5, T + 0.7))
    anchor('led_power', (4, 5, T + 0.7))
    save()
    return dict(name='ESP32 DevKit V1 (30-pin)', interface='mcu',
                dimensions_mm=dict(w=W, d=D, h=T + 3.1 + 8.5, source='photo',
                                   ref='Board 51.8x28.2 (measured, forum.fritzing.org/t/doit-esp32-devkit-v1/6158); '
                                       'WROOM-32 18x25.5x3.1 (Espressif datasheet); h = 8.5 header pins + 1.6 PCB + 3.1 module'),
                todo=['row spacing 22.86 mm read from render', 'pin rows centred along board length', 'micro-USB, buttons, chips and passives placed from the render',
                      'mounting holes assumed 3 mm at the corners', 'clones vary in width (23.4-28.5 mm)'])


CARRIER_TODO = 'carrier outline 27x18 and hole/pot/LED positions taken from the Sensor Module render (b65c5510.jfif); assumed same for all Robo Coders modules'


def trimmer(at):
    at = (at[0], at[1], 0)
    part('pot', [box((0, 0, T + 2.5), (9.5, 9.5, 5)), cyl((0, 0, T + 5.4), 2, 0.8, 12)], 'plastic_blue', at)
    anchor('pot', (at[0], at[1], T + 5.8))


def carrier(n=3, W=27, D=18, pot=(1.9, 4.5), leds=True, holes=True, xh_color='plastic_white'):
    """Robo Coders module board: right-angle XH on the right edge (opening +X), pins pin1..n bottom->top."""
    pcb(W, D, 'pcb_blue', holes=[(-W / 2 + 2, D / 2 - 2.2), (-W / 2 + 2, -D / 2 + 2.2)] if holes else [])
    xh('xh', [f'pin{i + 1}' for i in range(n)], (W / 2 - 0.5, 0, 0), rotz=90, color=xh_color, side=True)
    if pot:
        trimmer(pot)
    if leds:
        for nm, y, m in (('led_power', D / 2 - 2.1, 'led_green'), ('led_signal', -D / 2 + 1.6, 'led_clear')):
            smd(nm, (W / 2 - 3, y, 0), (3.2, 1.6, 0.7), m)
            anchor(nm, (W / 2 - 3, y, T + 0.7))


def input_header(W=27):
    """2-pin right-angle female input on the left edge of the Sensor Module (probe / plate cable)."""
    x = -W / 2 - 0.6
    part('in_header', [box((0, 0, T + 1.25), (6.5, 5.08, 2.5))], 'plastic_black', (x, 0, 0))
    for i, y in enumerate((-P / 2, P / 2)):
        anchor(f'in{i + 1}', (x - 3.25, y, T + 1.25), pin=True)
    return x - 3.25


def tb6612():
    new('tb6612')
    W = D = 20.32  # 0.8 x 0.8 in (SparkFun ROB-14451 product page)
    pcb(W, D, 'pcb_red', 'pcb')
    rx = 15.24 / 2  # rows 0.6" — photo, TODO confirm
    y0 = 3.5 * P
    male_pins_down('header_l', ['vm', 'vcc', 'gnd_1', 'ao1', 'ao2', 'bo2', 'bo1', 'gnd_2'], -rx, y0)
    male_pins_down('header_r', ['pwma', 'ain2', 'ain1', 'stby', 'bin1', 'bin2', 'pwmb', 'gnd_3'], rx, y0)
    # TB6612FNG in SSOP24: body 5.6 x 7.8, 12 gull-wing legs per side at 0.65 mm pitch (Toshiba datasheet)
    part('chip', [box((0, 0, T + 0.75), (5.6, 7.8, 1.3))], 'chip', (0, -1.5, 0))
    part('chip_legs', [box((sx * 3.3, (i - 5.5) * 0.65, T + 0.15), (1.0, 0.3, 0.3)) for sx in (-1, 1) for i in range(12)], 'metal', (0, -1.5, 0))
    anchor('chip', (0, -1.5, T + 1.4))
    smd('cap_1', (0, 6.8, 0), (3.2, 1.6, 0.6))
    smd('cap_2', (-3.2, 4.4, 0), (1.6, 0.8, 0.5), rotz=90)
    smd('cap_3', (3.2, 4.4, 0), (1.6, 0.8, 0.5), rotz=90)
    save()
    return dict(name='TB6612FNG motor driver breakout', interface='motor driver (PWM + direction)',
                dimensions_mm=dict(w=W, d=D, h=T + 1.4 + 8.5, source='datasheet',
                                   ref='0.8x0.8 in, SparkFun ROB-14451 product page; pin order from base-board schematic U6'),
                todo=['row spacing 0.6" read from render', 'chip and capacitor positions from render', 'socketed or soldered on base board'])


def base():
    """Robo Coders base board, SMART INNOVATOR KIT programmable board (EasyEDA top view + schematic, user 2026-11-21).
    100 x 90 mm: ESP32 socket pitch 2.54 mm = 21.0 px -> 8.27 px/mm; every pad position below was measured from the layout.
    Every XH port is top-entry (opening up), the yellow 4-pin ones included. CA-1235 power module under the ESP32."""
    new('base')
    W, D = 100.0, 90.0
    pcb(W, D, 'pcb_blue', 'pcb', holes=[(sx * 47.8, sy * 42.5) for sx in (-1, 1) for sy in (-1, 1)], r=3)
    ex, ey = -2.75, 14.96                            # ESP32 socket: rows 25.4 mm apart
    anchor('esp32_socket', (ex, ey, T + 8.5))          # the ESP32 plugs straight into the U2 / U1 female headers (user, 2026-11-24)
    mx, my = -2.2, 21.8                              # CA-1235 (U3) between the socket rows; pins 15 x 25 mm apart
    part('power_module', [rrect((0, 0, T + 2.8), (20, 30, 1.2), 0.6)], 'pcb_black', (mx, my, 0))
    part('power_module_pins', [box((sx * 7.5, sy * 12.5, T + 1.4), (0.64, 0.64, 2.8)) for sx in (-1, 1) for sy in (-1, 1)], 'gold', (mx, my, 0))
    anchor('power_module', (mx, my, T + 3.4))
    for nm, sx, sy in (('power_in_p', -1, 1), ('power_in_n', 1, 1), ('power_out_p', -1, -1), ('power_out_n', 1, -1)):
        anchor(nm, (mx + sx * 7.5, my + sy * 12.5, T + 3.4), pin=True)
    u2 = ['3v3', 'gnd', 'd15', 'd2', 'd4', 'rx2', 'tx2', 'd5', 'd18', 'd19', 'd21', 'rx0', 'tx0', 'd22', 'd23']
    u1 = ['vin', 'gnd', 'd13', 'd12', 'd14', 'd27', 'd26', 'd25', 'd33', 'd32', 'd35', 'd34', 'vn', 'vp', 'en']
    female_row('u2', [f'u2_{n}' for n in u2], ex - 12.7, ey + 7 * P)   # U2 / U1: the two 15-pin female headers the ESP32 sits in, 25.4 mm apart
    female_row('u1', [f'u1_{n}' for n in u1], ex + 12.7, ey + 7 * P)
    tx, ty = -1.6, -28.5                             # TB6612 (U6) socket, rows 15.24 apart
    female_row('tb6612_socket_l', [f'tb6612_{n}' for n in ['vm', 'vcc', 'gnd_1', 'ao1', 'ao2', 'bo2', 'bo1', 'gnd_2']], tx - 7.62, ty + 3.5 * P)
    female_row('tb6612_socket_r', [f'tb6612_{n}' for n in ['pwma', 'ain2', 'ain1', 'stby', 'bin1', 'bin2', 'pwmb', 'gnd_3']], tx + 7.62, ty + 3.5 * P)
    anchor('tb6612_socket', (tx, ty, T + 8.5))
    for port, y in (('ultrasonic', 25.1), ('rxtx', 9.2), ('i2c', -6.7)):   # 4-pin yellow XH along the left edge, top-entry (user, 2026-11-21)
        xh(port, [f'{port}_pin{i + 1}' for i in range(4)], (-45.9, y, 0), rotz=-90, color='plastic_yellow')
    xh('rgy', [f'rgy_pin{i + 1}' for i in range(4)], (42.9, 18.75, 0), rotz=90, color='plastic_yellow')  # TRAFFIC LIGHT, top-entry
    xh('rx2tx2', [f'rx2tx2_pin{i + 1}' for i in range(4)], (20.45, -15.7, 0), rotz=-90, color='plastic_yellow')     # CN2 (RX2/TX2), top-entry
    for port, y in (('d23', 29.3), ('d32', 17.1), ('d13', 3.8), ('d33', -9.2)):          # outputs, top-entry
        xh(port, [f'{port}_pin{i + 1}' for i in range(3)], (-35.8, y, 0), rotz=-90)
    for port, x, y in (('d36', 30.8, 4.0), ('d35', 42.9, 4.0), ('d39', 30.8, -11.0), ('d34', 42.9, -11.0)):  # inputs, top-entry
        xh(port, [f'{port}_pin{i + 1}' for i in range(3)], (x, y, 0), rotz=90)
    for port, x, y in (('motor_l1', -29.6, -29.7), ('motor_l2', -29.6, -39.6), ('motor_r1', 24.85, -29.7), ('motor_r2', 24.85, -39.6)):
        xh(port, [f'{port}_pin{i + 1}' for i in range(2)], (x, y - 0.4, 0))
    xh('bat', ['bat_pin1', 'bat_pin2'], (43.2, 30.75, 0), rotz=90)
    anchor('bat', (43.2, 30.75, T + 7))
    sx_, sy_ = -31.0, 39.7
    for i in range(3):  # SERVO 1x3 male, pins along X: 1 GND, 2 5V, 3 D33
        part(f'servo_pin_{i + 1}', [box((0, 0, T + 3), (0.64, 0.64, 6))], 'gold', (sx_ + (i - 1) * P, sy_, 0), key='pin_up')
        anchor(f'servo_pin{i + 1}', (sx_ + (i - 1) * P, sy_, T + 6), pin=True)
    part('servo', [box((0, 0, T + 1.25), (3 * P, 2.5, 2.5))], 'plastic_black', (sx_, sy_, 0))
    anchor('servo', (sx_, sy_, T + 6))
    x, y = 30.5, 31.0                                # SW1 KFC5858-W self-locking push switch (5.8 mm), ON/OFF
    part('sw1', [box((0, 0, T + 2), (5.8, 5.8, 4))], 'plastic_grey', (x, y, 0))
    part('sw1_cap', [box((0, 0, T + 4.75), (2.5, 2.5, 1.5))], 'plastic_white', (x, y, 0))
    anchor('sw1', (x, y, T + 5.5))
    for nm, x, y, rz in (('switch_motor_v', -22.4, -16.3, 0), ('switch_i2c_v', -45.4, -26.4, 90)):
        part(nm, [box((0, 0, T + 1.75), (8.6, 3.6, 3.5))], 'metal', (x, y, 0), rz, key='slide')
        part(f'{nm}_knob', [box((-1.5, 0, T + 4.25), (1.5, 1.5, 1.5))], 'plastic_black', (x, y, 0), rz, key='slide_knob')
        anchor(nm, (x, y, T + 5))
    for i, (x, y, rz, m) in enumerate(((-20.0, -26.1, 0, 'chip'), (-22.2, -31.3, 90, 'smd_tan'), (16.6, -31.3, 90, 'smd_tan'))):  # R1, C3, C1
        smd(f'smd_{i + 1}', (x, y, 0), (3.2, 1.6, 0.6), m, rotz=rz)
    save()
    return dict(name='Robo Coders base board', interface='carrier board',
                dimensions_mm=dict(w=W, d=D, h=round(T + 8.52, 2), source='photo',
                                   ref='SMART INNOVATOR KIT board, EasyEDA top view + schematic (user, 2026-11-21): scale from the ESP32 socket pitch, pads ±0.3 mm'),
                todo=['CA-1235 module body (20 x 30 mm) not in the 3D render: size from its pad spacing', 'SW1 and slide-switch bodies are typical sizes',
                      'TB6612 fitted in a socket (female headers) assumed', 'ESP32 sits in U1/U2 (user, 2026-11-24): moved from the outer layout positions (37.6 mm apart) to 25.4 mm, the DevKit row spacing'])


def ultrasonic():
    """Robo Coders ultrasonic carrier (YUGMINDS layout, 30.3 x 20.3 mm: XH pitch 2.54 mm = 29.5 px -> 11.6 px/mm) with an HC-SR04
    standing upright in a 4-pin female header at the left edge, transducers facing forward (-X); side-entry 4-pin XH
    (VCC, TRIG, ECHO, GND top to bottom). HC-SR04 45 x 20 mm PCB, transducers Ø16 x 12 mm (datasheet)."""
    new('ultrasonic')
    W, D = 30.3, 20.3
    part('pcb', [slab((0, 0, T / 2), plate_outline(W, D, 2.5), [circle(sx * 12.9, sy * 8.0, 1.0, 12) for sx in (-1, 1) for sy in (-1, 1)], depth=T)], 'pcb_blue')
    xh('xh', ['pin1', 'pin2', 'pin3', 'pin4'], (8.4, 0.08, 0), rotz=90, color='plastic_yellow', side=True)
    hx, hy = -11.8, 0.08                             # upright female header, socket up
    rows = [hy + (i - 1.5) * P for i in range(4)]
    part('header', [box((hx, hy, T + 4.25), (2.5, 4 * P, 8.5))], 'plastic_black')
    part('header_legs', [box(((hx + -9.05) / 2, y, T + 0.3), (abs(-9.05 - hx) + 0.5, 0.5, 0.5)) for y in rows], 'metal')
    zb = T + 8.5 + 2.5                               # HC-SR04 pin spacer sits on the socket; its PCB starts above it
    part('us_spacer', [box((hx, hy, T + 8.5 + 1.25), (2.5, 4 * P, 2.5))], 'plastic_black')
    part('us_pcb', [box((hx, 0, zb + 10), (1.6, 45, 20))], 'pcb_blue')
    zc = zb + 10
    for nm, y in (('transmitter', 13.0), ('receiver', -13.0)):   # T and R cans on the front face
        part(nm, [cyl((-6, 0, 0), 8.0, 12, 24, 'X')], 'metal', (hx - 0.8, y, zc), key='can')      # shared mesh: geometry at the origin, placed by `at`
        part(f'{nm}_mesh', [cyl((-12.02, 0, 0), 6.6, 0.06, 24, 'X')], 'mesh_dark', (hx - 0.8, y, zc), key='mesh')
        anchor(nm, (hx - 12.9, y, zc))
    part('crystal', [box((hx + 0.8 + 1.75, 0, zc + 5), (3.5, 11, 4.4))], 'metal')       # HC-49 can on the back
    part('chips', [box((hx + 0.8 + 0.75, sy * 9, zc - 3), (1.5, 5, 4)) for sy in (-1, 1)], 'chip')
    anchor('us_pcb', (hx + 1, 0, zb + 19))
    save()
    return dict(name='Ultrasonic sensor (HC-SR04)', interface='digital (trigger/echo)',
                dimensions_mm=dict(w=round(W / 2 - (hx - 12.8), 2), d=45, h=round(zb + 20, 2), source='photo',
                                   ref='Robo Coders ultrasonic carrier PCB top view (user, 2026-11-21), scaled from XH pitch ±0.5 mm; HC-SR04 45x20, Ø16x12 transducers (datasheet)'),
                todo=['HC-SR04 plugged upright into the left socket, facing forward (confirmed by user 2026-11-21)',
                      'transducer spacing 26 mm and back-side parts placeholders'])


def dht11():
    """Robo Coders DHT11 module (YUGMINDS layout, 30.4 x 20.3 mm: XH pitch 2.54 mm = 29.5 px -> 11.6 px/mm): DHT11 lying flat,
    grille up, over its 4 pads at the left edge (as in the render); R3 1 kΩ + LED1 power LED, R1 10 kΩ DATA pull-up; side-entry
    3-pin XH (VCC, GND, DO). DHT11 body 15.5 x 12 x 5.5 mm (Aosong datasheet)."""
    new('dht11')
    W, D = 30.4, 20.3
    part('pcb', [slab((0, 0, T / 2), plate_outline(W, D, 2.5), [circle(sx * 13.4, sy * 8.3, 1.0, 12) for sx in (-1, 1) for sy in (-1, 1)], depth=T)], 'pcb_blue')
    xh('xh', ['pin3', 'pin2', 'pin1'], (13.0, 0.17, 0), rotz=90, side=True)
    sx, z0 = -9.4, T + 0.6                          # body 12 (x) x 15.5 (y) x 5.5, flush with the left edge
    part('sensor', [box((sx, 0, z0 + 2.75), (12, 15.5, 5.5))], 'plastic_lightblue')
    holes = [box((sx - 3.6 + 2.4 * i, -5.6 + 2.8 * j, z0 + 5.52), (1.5, 1.9, 0.06)) for i in range(4) for j in range(5)]
    part('grille', holes, 'plastic_blue')
    part('ribs', [box((sx + 6.4, y, z0 + 2.75), (0.8, 2.6, 4.4)) for y in (-4.6, 0, 4.6)], 'plastic_lightblue')
    part('sensor_legs', [box((-8.1, y, (T + z0) / 2), (0.5, 0.5, z0 - T + 0.2)) for y in (3.8, 1.2, -1.4, -3.9)], 'metal')
    anchor('sensor', (sx, 0, z0 + 5.5))
    for nm, x, val in (('r_3', 0.4, '1k'), ('r_1', 3.6, '10k')):          # vertical 1206 resistors
        part(nm, [box((0, 0, T + 0.28), (1.6, 2.0, 0.55))], 'chip', (x, 1.36, 0), key='r1206v')
        part(f'{nm}_ends', [box((0, sy * 1.3, T + 0.3), (1.6, 0.6, 0.6)) for sy in (-1, 1)], 'metal', (x, 1.36, 0), key='r1206v_ends')
        anchor(nm, (x, 1.36, T + 0.6))
    part('led_power', [box((0, 0, T + 0.5), (2.0, 1.6, 1.0))], 'led_clear', (2.35, -4.8, 0))
    part('led_power_ends', [box((sx_ * 1.3, 0, T + 0.3), (0.6, 1.6, 0.6)) for sx_ in (-1, 1)], 'metal', (2.35, -4.8, 0))
    anchor('led_power', (2.35, -4.8, T + 1.0))
    save()
    return dict(name='Temperature and humidity sensor (DHT11)', interface='digital (single wire)',
                dimensions_mm=dict(w=round(16.5 - (sx - 6), 2), d=D, h=round(z0 + 5.5, 2), source='photo',
                                   ref='Robo Coders DHT11 PCB top view + schematic (user, 2026-11-21), scaled from XH pitch ±0.5 mm; DHT11 15.5x12x5.5 (Aosong)'),
                todo=['DHT11 lies flat over its pads, grille up (confirmed by user 2026-11-21; the silkscreen outline is for an upright part)',
                      'LED1 colour unknown (power LED through R3)'])


def ldr():
    """Robo Coders LDR sensor: the A-D board with a 5 mm LDR (GL5528 style) soldered upright on the H1 pads, face up."""
    new('ldr')
    ad_board(h1=False)
    x, y, z0 = -12.1, 1.35, T + 4.0                 # 4 mm of leg under the head
    part('ldr_legs', [box((0, dy, T + 2.0), (0.5, 0.5, 4.0)) for dy in (-P / 2, P / 2)], 'metal', (x, y, 0))
    part('ldr', [cyl((0, 0, z0 + 0.9), 2.55, 1.8, 24)], 'plastic_white', (x, y, 0))           # ceramic body
    part('ldr_cds', [cyl((0, 0, z0 + 1.82), 2.2, 0.04, 24)], 'cds', (x, y, 0))                # CdS film
    comb = [box((0, sy * 1.75, z0 + 1.87), (3.0, 0.5, 0.06)) for sy in (-1, 1)]                 # two silver electrodes...
    comb += [box((-1.2 + 0.6 * k, (1 if k % 2 else -1) * 0.35, z0 + 1.87), (0.22, 2.9, 0.06)) for k in range(5)]  # ...interleaved fingers
    part('ldr_comb', comb, 'metal', (x, y, 0))
    anchor('ldr', (x, y, z0 + 1.9))
    save()
    return dict(name='Light sensor (LDR)', interface='digital threshold (DO)',
                dimensions_mm=dict(w=AD_W + 2, d=AD_D, h=round(T + 5.9 + 0.03 + 1.5, 2), source='photo', ref=AD_REF),
                todo=['5 mm LDR (GL5528 style, typical size) soldered upright on the H1 pads like the mic; real part number unknown',
                      'underside parts placed from the schematic only (no bottom view)'])


def touch():
    """Robo Coders touch sensor (YUGMINDS layout): TTP223 (SOT-23-6), C1/C2, R1, LED1, solder jumpers J1 (toggle) and
    J2 (active low), top-entry 3-pin XH (VCC, GND, DO left to right) and the touch pad (copper under the mask, lower 2/3).
    Scaled from the EasyEDA top view: XH pitch 2.54 mm = 29.25 px -> 11.5 px/mm, ±0.5 mm."""
    new('touch')
    W, D = 20.4, 30.8
    holes = [circle(sx * 8.9, 13.4, 0.85, 12) for sx in (-1, 1)]
    part('pcb', [slab((0, 0, T / 2), plate_outline(W, D, 2.0), holes, depth=T)], 'pcb_blue')
    part('pad', [box((0, -5.15, T + 0.025), (19.2, 16.3, 0.05))], 'pcb_blue')        # touch electrode: the click/press target
    anchor('pad', (0, -5.15, T + 0.05))
    xh('xh', ['pin1', 'pin2', 'pin3'], (-0.3, 11.3, 0))
    def chip1206(name, at, body, vertical, lens=False):
        sx, sy = (1.6, 3.2) if vertical else (3.2, 1.6)
        part(name, [box((0, 0, T + 0.5), (sx, sy, 1.0) if lens else (sx * (0.6 if not vertical else 1), sy * (0.6 if vertical else 1), 0.55))], body, at, key=f'{name}_body')
        ends = [box((0, s * (sy / 2 - 0.3), T + 0.3), (sx, 0.6, 0.6)) for s in (-1, 1)] if vertical else [box((s * (sx / 2 - 0.3), 0, T + 0.3), (0.6, sy, 0.6)) for s in (-1, 1)]
        part(f'{name}_ends', ends, 'metal', at)
    chip1206('c1', (-8.0, 9.3, 0), 'smd_tan', True)
    chip1206('c2', (-1.5, 5.6, 0), 'smd_tan', True)
    chip1206('r1', (5.0, 6.0, 0), 'chip', False)
    chip1206('led', (8.1, 9.1, 0), 'led_clear', True, lens=True)
    anchor('led', (8.1, 9.1, T + 1.0))
    part('ttp223', [box((0, 0, T + 0.55), (1.6, 2.9, 1.1))], 'chip', (-6.0, 5.8, 0))
    part('ttp223_legs', [box((sx * 1.15, y, T + 0.25), (0.7, 0.4, 0.2)) for sx in (-1, 1) for y in (-0.95, 0, 0.95)], 'metal', (-6.0, 5.8, 0))
    anchor('ttp223', (-6.0, 5.8, T + 1.1))
    for nm, y in (('j1', 7.8), ('j2', 6.0)):              # open solder jumpers; a blob of solder closes them (shown at runtime)
        part(nm, [box((-0.55, 0, T + 0.02), (0.9, 1.2, 0.04)), box((0.55, 0, T + 0.02), (0.9, 1.2, 0.04))], 'gold', (2.0, y, 0), key='jumper_pads')
        part(f'{nm}_solder', [cyl((0, 0, T + 0.2), 0.75, 0.4, 12)], 'metal', (2.0, y, 0), key='jumper_solder')
        anchor(nm, (2.0, y, T + 0.4))
    save()
    return dict(name='Touch sensor (TTP223)', interface='digital (DO)',
                dimensions_mm=dict(w=W, d=D, h=T + 7.0, source='photo',
                                   ref='Robo Coders touch sensor PCB top view + schematic (user, 2026-11-21), scaled from XH pitch, ±0.5 mm'),
                todo=['LED1 colour not given in the schematic; yellow assumed from the render', 'pad area 19.2x16.3 mm from the silkscreen outline'])


def ir():
    """Robo Coders IR obstacle sensor: the A-D board with IR1 (5 mm IR LED, top) and CGQ1 (5 mm phototransistor, below it)
    soldered on their footprints at the left edge and bent 90° to look forward (-X). Positions from the board's EasyEDA top view."""
    new('ir')
    ad_board(h1=False)
    x0, zc = -15.4, T + 3.0                          # bent 90° forward: back of the flange just past the left edge, looking -X
    for nm, y, m in (('ir_led', 4.7, 'led_clear'), ('receiver', -2.4, 'led_smoke')):   # IR1 clear epoxy, CGQ1 dark IR-filter epoxy
        led5_lens(nm, (x0, y, zc), m, axis='-X')
        legs = []
        for dy in (-1.27, 1.27):                     # up from the pad, then a right-angle bend into the back of the part
            legs += [box((-12.1, dy, (T + zc) / 2), (0.45, 0.45, zc - T)), box(((-12.1 + x0) / 2, dy, zc), (x0 + 12.1 - 0.45, 0.45, 0.45))]
        part(f'{nm}_legs', legs, 'metal', (0, y, 0), key='ir_legs')
        anchor(nm, (x0 - 8.6, y, zc))
    save()
    return dict(name='IR obstacle sensor', interface='digital threshold (DO)',
                dimensions_mm=dict(w=round(17.2 + 23.9, 2), d=AD_D, h=round(T + 6.05 + 1.5, 2), source='photo', ref=AD_REF + '; IR1/CGQ1 footprints from the IR SENSOR layout'),
                todo=['5 mm IR LED and phototransistor sizes typical; bent 90° forward (user, 2026-11-21), leg length to the bend assumed',
                      'underside parts placed from the schematic only (no bottom view)'])

AD_REF = 'Robo Coders A-D sensor board (YUGMINDS layout) top view + schematic (user, 2026-11-21): XH pitch 2.54 mm = 56.25 px -> 22.1 px/mm, ±0.5 mm'
AD_W, AD_D = 30.4, 20.2


def ad_board(h1=True):
    """Robo Coders A-D comparator board (mic / soil / rain): LM393, R6 trimmer, LEDs S/P, 3-pin XH (VCC, GND, DO) on the right,
    2-pin H1 on the left (right-angle female header, opening -X; the mic board solders its capsule onto the H1 pads instead).
    Returns the H1 opening (x, y, z)."""
    pcb(AD_W, AD_D, 'pcb_blue', r=2.0)
    hy, hz = 1.35, T + 1.27
    if h1:
        part('h1', [box((-14.3, hy, hz), (7.0, 5.08, 2.54))], 'plastic_black')
        part('h1_holes', [box((-17.82, hy + y, hz), (0.04, 1.0, 1.0)) for y in (-P / 2, P / 2)], 'chip')
        anchor('h1', (-17.8, hy, T + 2.54))
    rx, ry = 1.65, 4.2
    part('pot', [box((0, 0, T + 2.4), (6.6, 7.0, 4.8))], 'plastic_blue', (rx, ry, 0))
    part('pot_screw', [cyl((0, 0, T + 5.0), 1.6, 0.5, 16), box((0, 0, T + 5.3), (2.6, 0.5, 0.2)), box((0, 0, T + 5.3), (0.5, 2.6, 0.2))], 'plastic_white', (rx, ry, 0))
    anchor('pot', (rx, ry, T + 5.4))
    for nm, y in (('led_signal', 8.0), ('led_power', -7.1)):
        part(nm, [box((0, 0, T + 0.55), (2.0, 1.6, 1.1))], 'led_clear', (11.7, y, 0), key='led1206')
        part(f'{nm}_ends', [box((sx * 1.3, 0, T + 0.5), (0.6, 1.6, 1.0)) for sx in (-1, 1)], 'metal', (11.7, y, 0), key='led1206_ends')
        anchor(nm, (11.7, y, T + 1.1))
    xh('xh', ['pin3', 'pin2', 'pin1'], (13.7, 0.45, 0), rotz=90, side=True)
    part('lm393', [box((0, 0, -0.75), (4.9, 3.9, 1.5))], 'chip', (2, -3, 0))
    part('lm393_legs', [box((sx * 2.9, (i - 1.5) * 1.27, -0.4), (1.0, 0.4, 0.2)) for sx in (-1, 1) for i in range(4)], 'metal', (2, -3, 0))
    anchor('lm393', (2, -3, -1.5))
    for i, (x, y, m) in enumerate(((-6, 4, 'chip'), (-6, 1.5, 'chip'), (-6, -1, 'chip'), (8, 3, 'chip'), (-6, -4, 'smd_tan'), (8, -2, 'smd_tan'))):
        part(f'smd_{i + 1}', [box((0, 0, -0.25), (2.0, 1.25, 0.5))], m, (x, y, 0), key=f'smd_b_{m}')
    return (-17.8, hy, hz)


def jumper(a, b, lift=0.0):
    """2-wire male-male jumper: housing plugged into H1 at a (opening faces -X, from the board) and into the probe/plate
    socket at b. lift > 0: b is a top-entry socket (housing stands up, wires leave from its top at that height)."""
    (ax, ay, az), (bx, by, bz) = a, b
    part('jumper_a', [box((ax - 3, ay, az), (6, 5.08, 2.54))], 'plastic_black')
    wires = {'wire_red': [], 'wire_black': []}
    for k, (m, dy) in enumerate((('wire_red', P / 2), ('wire_black', -P / 2))):
        if lift:
            top = bz + lift
            wires[m] += [box(((ax - 6 + bx) / 2, ay + dy, top), (ax - 6 - bx + 0.9, 0.9, 0.9)),
                         box((ax - 6, ay + dy, (top + az) / 2), (0.9, 0.9, top - az + 0.9))]
        else:
            wires[m] += [box(((ax - 6 + bx + 6) / 2, ay + dy, az), (ax - bx - 12, 0.9, 0.9))]
    for m, prims in wires.items():
        part(m, prims, m)
    if lift:
        part('jumper_b', [box((bx, by, bz + lift / 2), (2.54, 5.08, lift))], 'plastic_black')
    else:
        part('jumper_b', [box((bx + 3, by, bz), (6, 5.08, 2.54))], 'plastic_black')


def mic():
    """Robo Coders mic sensor: the A-D board with the electret capsule soldered upright on the H1 pads."""
    new('mic')
    ad_board(h1=False)
    mx, my, z0 = -12.1, 1.35, T + 0.5                # capsule Ø9.7 x 6.7, sound port up
    part('mic_legs', [box((0, y, T + 0.25), (0.5, 0.5, 0.5)) for y in (-P / 2, P / 2)], 'metal', (mx, my, 0))
    part('mic', [cyl((0, 0, z0 + 3.35), 4.85, 6.7, 24)], 'plastic_black', (mx, my, 0))
    part('mic_felt', [cyl((0, 0, z0 + 6.72), 4.1, 0.06, 24)], 'mesh_dark', (mx, my, 0))
    anchor('mic', (mx, my, z0 + 6.75))
    save()
    return dict(name='Microphone (sound) sensor', interface='digital threshold (DO)',
                dimensions_mm=dict(w=34.05, d=AD_D, h=10.35, source='photo', ref=AD_REF),
                todo=['electret capsule Ø9.7x6.7 mm (typical size, confirm), soldered upright on the H1 pads, overhangs the left edge',
                      'underside parts placed from the schematic only (no bottom view)'])


def gas():
    """Robo Coders gas sensor (YUGMINDS layout): MQ-2 on the left, trimmer R6, LEDs S/P, 3-pin XH (VCC, GND, DO).
    Board size and positions scaled from the EasyEDA top view: XH pitch 2.54 mm = 28.5 px -> 11.2 px/mm."""
    new('gas')
    W, D = 44, 33
    pcb(W, D, 'pcb_blue', r=3)
    mx = -11.6                                       # MQ-2 centre (sensor footprint U1)
    for k in range(6):                               # six legs, 1 mm stand-off under the base
        a = math.radians(30 + 60 * k)
        part(f'mq_leg_{k + 1}', [cyl((0, 0, T + 0.5), 0.45, 1.0, 6)], 'metal', (mx + 5 * math.cos(a), 5 * math.sin(a), 0), key='mq_leg')
    z = T + 1.0
    part('mq_base', [cyl((0, 0, z + 1.9), 9.8, 3.8, 32)], 'bakelite', (mx, 0, 0))
    z += 3.8
    part('mq_flange', [cyl((0, 0, z + 0.4), 10.0, 0.8, 32)], 'steel', (mx, 0, 0))
    z += 0.8
    part('mq_cap', [cyl((0, 0, z + 4.5), 8.8, 9.0, 32), cyl((0, 0, z + 9.4), 8.8, 0.8, 32, 'Z', 8.1)], 'mesh_steel', (mx, 0, 0))
    z += 9.8
    part('mq_top', [cyl((0, 0, z + 0.02), 8.1, 0.04, 32)], 'mesh_dark', (mx, 0, 0))
    part('heater', [cyl((0, 0, z - 0.6), 3.0, 1.2, 16)], 'heater', (mx, 0, 0))  # sensing element seen through the mesh
    wires, pitch = [], 1.15                           # stainless double mesh on top: crossing wires clipped to the circle
    for i in range(-6, 7):
        u = i * pitch
        L = 2 * math.sqrt(max(8.1 ** 2 - u ** 2, 0))
        if L > 1:
            wires += [box((u, 0, z + 0.1), (0.32, L, 0.14)), box((0, u, z + 0.22), (L, 0.32, 0.14))]
    part('mq_mesh', wires, 'steel', (mx, 0, 0))
    anchor('element', (mx, 0, z + 0.3))
    anchor('mq_base', (mx - 9.8, 0, T + 3))
    # R6: 3362P trimmer (6.6 x 7 x 4.8), screw on top
    rx, ry = 5.6, -11.3
    part('pot', [box((0, 0, T + 2.4), (6.6, 7.0, 4.8))], 'plastic_blue', (rx, ry, 0))
    part('pot_screw', [cyl((0, 0, T + 5.0), 1.6, 0.5, 16), box((0, 0, T + 5.3), (2.6, 0.5, 0.2)), box((0, 0, T + 5.3), (0.5, 2.6, 0.2))], 'plastic_white', (rx, ry, 0))
    anchor('pot', (rx, ry, T + 5.4))
    # S (signal) and P (power) LEDs: 1206, clear body, tinned ends
    for nm, y in (('led_signal', 10.4), ('led_power', -9.4)):
        part(nm, [box((0, 0, T + 0.55), (2.0, 1.6, 1.1))], 'led_clear', (16.9, y, 0), key='led1206')
        part(f'{nm}_ends', [box((sx * 1.3, 0, T + 0.5), (0.6, 1.6, 1.0)) for sx in (-1, 1)], 'metal', (16.9, y, 0), key='led1206_ends')
        anchor(nm, (16.9, y, T + 1.1))
    # JST-XH 3-pin, right angle, opening at the right edge; top->bottom VCC, GND, DO (pin 1, 2, 3)
    xh('xh', ['pin3', 'pin2', 'pin1'], (20.5, 0, 0), rotz=90, side=True)
    # underside (schematic parts; not visible in the top view): LM393 comparator, R1/R2/R4/R5, C1/C2
    part('lm393', [box((0, 0, -0.75), (4.9, 3.9, 1.5))], 'chip', (6, 3, 0))
    part('lm393_legs', [box((sx * 2.9, (i - 1.5) * 1.27, -0.4), (1.0, 0.4, 0.2)) for sx in (-1, 1) for i in range(4)], 'metal', (6, 3, 0))
    anchor('lm393', (6, 3, -1.5))
    for i, (x, y, m) in enumerate(((0, -4, 'chip'), (2.5, -4, 'chip'), (5, -4, 'chip'), (7.5, -4, 'chip'), (11, 3, 'smd_tan'), (11, -1, 'smd_tan'))):
        part(f'smd_{i + 1}', [box((0, 0, -0.25), (2.0, 1.25, 0.5))], m, (x, y, 0), key=f'smd_b_{m}')
    save()
    return dict(name='Gas sensor (MQ-2)', interface='analog (AO) + digital threshold (DO)',
                dimensions_mm=dict(w=W + 2, d=D, h=round(z + 0.29 + 1.5, 2), source='photo',  # h includes the 1.5 mm LM393 underneath
                                   ref='Robo Coders gas sensor PCB top view + schematic (user, 2026-11-21), scaled from XH pitch, ±1 mm'),
                todo=['MQ-2 body Ø20 x 15.5 mm from typical datasheet values, confirm', 'board 44x33 mm scaled from the layout image',
                      'underside parts placed from the schematic only (no bottom view)', 'AO not on the connector: schematic routes only DO to U13'])


def soil():
    """Soil moisture: A-D board + YUGMINDS fork probe (scaled from its 2-pin header: 2.54 mm = 44 px -> 17.3 px/mm, ±1 mm),
    lying to the left with its header toward the board, joined by a 2-wire jumper."""
    new('soil')
    h1 = ad_board()
    cx = -62.0                                       # probe centre; local (u, v): v along the fork, header at +v
    cy = h1[1] - 0.3                                 # header in line with H1
    w = lambda u, v, z=0: (cx + v, cy - u, z)        # probe local -> model (turned so the header faces the board)
    tip = [(-9.9, 19.95), (9.9, 19.95), (9.9, -17.7), (6.55, -19.95), (3.2, -17.7), (3.2, 10.6), (-3.0, 10.6), (-3.0, -17.7), (-6.45, -19.95), (-9.9, -17.7)]
    part('probe', [slab((0, 0, T / 2), [w(u, v)[:2] for u, v in tip], depth=T)], 'pcb_blue')
    for nm, u in (('probe_a', -6.35), ('probe_b', 6.85)):
        x, y, _ = w(u, -0.05)
        part(nm, [rrect((x, y, T + 0.02), (36.7, 5.5, 0.04), 2.7, 6)], 'gold')
    anchor('probe', w(0, -15, T + 0.05))
    hx, hy, _ = w(-0.3, 18.2)
    xo = cx + 19.95 + 2.0                            # right-angle 2-pin header lying flat at the top of the fork, opening +X toward the board
    part('probe_header', [box((xo - 2.2, hy, T + 1.27), (4.4, 5.08, 2.54))], 'plastic_black')
    part('probe_header_holes', [box((xo + 0.02, hy + y, T + 1.27), (0.04, 1.0, 1.0)) for y in (-P / 2, P / 2)], 'chip')
    anchor('probe_header', (xo, hy, T + 2.54))
    jumper(h1, (xo, hy, T + 1.27))
    save()
    return dict(name='Soil moisture sensor', interface='digital threshold (DO)',
                dimensions_mm=dict(w=round(AD_W / 2 + 2 - (cx - 19.95), 2), d=AD_D, h=round(T + 6.05 + 1.5, 2), source='photo', ref=AD_REF + '; fork probe 19.8 x 39.9 mm'),
                todo=['jumper between H1 and the probe is drawn short; the real cable length and type are unknown',
                      'probe header: right-angle 2-pin lying flat, facing the board (user, 2026-11-21)', 'underside parts placed from the schematic only'])


def rain():
    """Rain sensor: A-D board + YUGMINDS comb plate (scaled from its H1 header: 2.54 mm = 54 px -> 21.3 px/mm, ±1 mm),
    lying to the left with H1 facing the board, joined by a 2-wire jumper."""
    new('rain')
    h1 = ad_board()
    W, D = 33.2, 26.7
    cx = h1[0] - 22 - 17.9                           # plate centre: 22 mm of jumper between the two sockets
    cy = h1[1] - 0.25                                # plate H1 in line with the board's H1
    holes = [circle(cx + sx * 14.55, cy + sy * 11.4, 0.95, 10) for sx in (-1, 1) for sy in (-1, 1)]
    part('plate', [slab((0, 0, T / 2), [(cx + x, cy + y) for x, y in plate_outline(W, D, 1.5)], holes, depth=T)], 'pcb_blue')
    z, tw = T + 0.02, 0.85
    def trace(x0, y0, x1, y1):                       # straight copper track as a thin quad
        L = math.hypot(x1 - x0, y1 - y0); nx, ny = -(y1 - y0) / L * tw / 2, (x1 - x0) / L * tw / 2
        return slab((cx, cy, z), [(x0 + nx, y0 + ny), (x0 - nx, y0 - ny), (x1 - nx, y1 - ny), (x1 + nx, y1 + ny)], depth=0.04)
    comb = [trace(-12.7, 11.8, 12.0, 11.8), trace(-12.7, -11.3, 12.0, -11.3)]                       # top and bottom bars
    comb += [trace(-11.4 + 2.7 * k, 11.8, -11.4 + 2.7 * k, -10.3) for k in range(9)]                 # fingers from the top bar
    comb += [trace(-12.7 + 2.65 * k, -11.3, -12.7 + 2.65 * k, 10.8) for k in range(10)]              # fingers from the bottom bar
    comb += [trace(12.0, 11.8, 14.6, 9.0), trace(14.6, 9.0, 14.6, 1.5),                               # right frame, split at H1
             trace(12.0, -11.3, 14.6, -8.5), trace(14.6, -8.5, 14.6, -1.0)]
    part('comb', comb, 'gold')
    anchor('comb', (cx - 5, cy + 3, z + 0.02))
    part('plate_h1', [box((cx + 15.7, cy + 0.25, T + 1.27), (4.4, 5.08, 2.54))], 'plastic_black')
    anchor('plate_h1', (cx + 17.9, cy + 0.25, T + 2.54))
    jumper(h1, (cx + 17.9, cy + 0.25, T + 1.27))
    save()
    return dict(name='Rain sensor', interface='digital threshold (DO)',
                dimensions_mm=dict(w=round(AD_W / 2 + 2 - (cx - W / 2), 2), d=D, h=round(T + 6.05 + 1.5, 2), source='photo', ref=AD_REF + '; comb plate 33.2 x 26.7 mm'),
                todo=['plate size scaled from its 2-pin header only; classic rain plates are larger (54x40), confirm',
                      'jumper between the two H1 sockets is drawn 22 mm long; real cable unknown', 'underside parts placed from the schematic only'])


WORKBOOK = 'module board 24x16 mm, 4 holes, XH on right edge: measured from workbook renders (pages 130-147), ±1.5 mm'


def module_board(n=3, holes=True):
    """Robo Coders I/O module board as drawn in the workbook (LED, buzzer, button)."""
    W, D = 24, 16
    pcb(W, D, 'pcb_blue', holes=[(sx * 10.3, sy * 6.35) for sx in (-1, 1) for sy in (-1, 1)] if holes else [], r=1.5)
    xh('xh', [f'pin{i + 1}' for i in range(n)], (W / 2 - 2.6, 0, 0), rotz=90, side=True)


def led5_lens(name, at, material, axis='Z'):
    """The lens + lead frame of a 5 mm LED with its back (flange face) at `at`, pointing up ('Z') or forward ('-X')."""
    dome = [(2.5 * math.cos(math.radians(a)), 6.1 + 2.5 * math.sin(math.radians(a))) for a in range(0, 91, 15)]
    prof = [(0, 0), (2.9, 0), (2.9, 1.0), (2.5, 1.0), *dome[:-1], (0.01, 8.6)]
    part(name, [lathe((0, 0, 0), prof, 24, axis, smooth=True)], material, at)
    # inside: (along-axis centre, sideways centre, along-axis length, sideways width); thin (0.45) across the other way
    pieces = [(2.2, -0.55, 3.6, 1.5), (2.3, 0.75, 3.8, 0.55)]            # cathode anvil, anode post
    if axis == 'Z':
        frame = [box((0, s_, a), (0.45, w, l)) for a, s_, l, w in pieces] + [cyl((0, -0.55, 4.25), 0.75, 0.5, 10, 'Z', 0.95), box((0, 0.1, 4.55), (0.06, 1.3, 0.06))]
        die = box((0, -0.55, 4.55), (0.35, 0.35, 0.15))
    else:
        frame = [box((-a, s_, 0), (l, w, 0.45)) for a, s_, l, w in pieces] + [cyl((-4.25, -0.55, 0), 0.95, 0.5, 10, 'X', 0.75), box((-4.55, 0.1, 0), (0.06, 1.3, 0.06))]
        die = box((-4.55, -0.55, 0), (0.15, 0.35, 0.35))
    part(f'{name}_frame', frame, 'metal', at, key=f'led5_frame{axis}')
    part(f'{name}_die', [die], 'chip', at, key=f'led5_die{axis}')


def led5(name, at, material, key=None):
    """Real 5 mm through-hole LED standing on the board: tinted epoxy (flange, body, round dome, smooth) with the lead frame
    visible inside: cathode anvil with its reflector cup and die, anode post, bond wire. `name` is the lens (glowed at runtime),
    `name`_frame the metal inside. Body Ø5 x 8.6 mm, flange Ø5.8 (datasheet typical). Returns the dome-top z."""
    x, y, z0 = at[0], at[1], T + 1.0                 # flange 1 mm above the board
    led5_lens(name, (x, y, z0), material)
    part(f'{name}_legs', [box((0, dy, T + 0.5), (0.45, 0.45, 1.0)) for dy in (-1.27, 1.27)], 'metal', (x, y, 0), key='led5_legs')
    return z0 + 8.6


def led():
    """Robo Coders LED module (YUGMINDS layout, one board for red / yellow / green; 30 x 20 mm: XH pitch 2.54 mm = 30 px ->
    11.7 px/mm): 5 mm LED fitted upright from the top, R1 1 kΩ in series, side-entry 3-pin XH (VCC, GND, DI). Colour is set at runtime."""
    new('led')
    W, D = 30.0, 20.0
    part('pcb', [slab((0, 0, T / 2), plate_outline(W, D, 2.5), [circle(sx * 12.8, sy * 8.1, 1.0, 12) for sx in (-1, 1) for sy in (-1, 1)], depth=T)], 'pcb_blue')
    xh('xh', ['pin3', 'pin2', 'pin1'], (13.0, 0.05, 0), rotz=90, side=True)
    x, y = -10.9, 0.58
    top = led5('lens', (x, y), 'led_red')
    anchor('led', (x, y, top))
    part('r_1', [box((0, 0, T + 0.28), (2.0, 1.6, 0.55))], 'chip', (-1.15, -3.16, 0))
    part('r_1_ends', [box((sx * 1.3, 0, T + 0.3), (0.6, 1.6, 0.6)) for sx in (-1, 1)], 'metal', (-1.15, -3.16, 0))
    anchor('r_1', (-1.15, -3.16, T + 0.6))
    save()
    return dict(name='LED module (red / yellow / green)', interface='digital / PWM',
                dimensions_mm=dict(w=round(W / 2 + 16.5, 2), d=D, h=round(top, 2), source='photo',
                                   ref='Robo Coders LED module PCB top view + schematic (user, 2026-11-21), scaled from XH pitch, ±0.5 mm'),
                todo=['5 mm LED (LED-TH-5mm footprint) fitted upright from the top; lens colour set per module at runtime'])

def buzzer():
    """Robo Coders buzzer module (YUGMINDS layout, 30.3 x 20 mm: XH pitch 2.54 mm = 29.5 px -> 11.6 px/mm): 12 mm buzzer on the
    left (+ top, - bottom), Q2 BC847 NPN (SOT-23) switching it, R1 1 kΩ base resistor, side-entry 3-pin XH (VCC, GND, DI)."""
    new('buzzer')
    W, D = 30.3, 20.0
    part('pcb', [slab((0, 0, T / 2), plate_outline(W, D, 2.5), [circle(-13.1, sy * 8.1, 1.0, 12) for sy in (-1, 1)], depth=T)], 'pcb_blue')
    xh('xh', ['pin3', 'pin2', 'pin1'], (13.0, 0, 0), rotz=90, side=True)
    bx = -8.3
    part('body', [cyl((0, 0, T + 4.75), 6.0, 9.5, 32)], 'plastic_black', (bx, 0, 0))
    part('opening', [cyl((0, 0, T + 9.5), 1.0, 0.04, 16)], 'chip', (bx, 0, 0))
    part('mark', [box((0, 3.3, T + 9.52), (1.6, 0.3, 0.04)), box((0, 3.3, T + 9.52), (0.3, 1.6, 0.04)),
                  box((0, -3.4, T + 9.52), (0.3, 1.4, 0.04))], 'plastic_white', (bx, 0, 0))
    anchor('buzzer', (bx, 0, T + 9.5))
    qx, qy = 1.95, -1.0                              # Q2: SOT-23, two legs up (B, E), one down (C)
    part('transistor', [box((0, 0, T + 0.55), (2.9, 1.3, 1.0))], 'chip', (qx, qy, 0))
    part('transistor_legs', [box((-0.95, 0.9, T + 0.15), (0.4, 0.6, 0.3)), box((0.95, 0.9, T + 0.15), (0.4, 0.6, 0.3)),
                             box((0, -0.9, T + 0.15), (0.4, 0.6, 0.3))], 'metal', (qx, qy, 0))
    anchor('transistor', (qx, qy, T + 1.1))
    part('r_1', [box((0, 0, T + 0.28), (2.0, 1.6, 0.55))], 'chip', (9.6, -8.1, 0))
    part('r_1_ends', [box((sx * 1.3, 0, T + 0.3), (0.6, 1.6, 0.6)) for sx in (-1, 1)], 'metal', (9.6, -8.1, 0))
    anchor('r_1', (9.6, -8.1, T + 0.6))
    save()
    return dict(name='Buzzer module', interface='digital / tone',
                dimensions_mm=dict(w=round(W / 2 + 16.5, 2), d=D, h=round(T + 9.52, 2), source='photo',
                                   ref='Robo Coders buzzer PCB top view + schematic (user, 2026-11-21), scaled from XH pitch, ±0.5 mm'),
                todo=['buzzer Ø12x9.5 mm typical; active or passive unknown (lessons play tones, so treated as passive)',
                      'Q2 leg order (B, E up, C down) assumed from the SOT-23 footprint'])

def button():
    """Robo Coders push button module (YUGMINDS layout, 30.4 x 20.3 mm: XH pitch 2.54 mm = 29 px -> 11.55 px/mm): 6 x 6 mm
    tactile switch SW1 (K2-1102DP) from VCC to DO, R1 10 kΩ pull-down DO -> GND, side-entry 3-pin XH (VCC, GND, DO)."""
    new('button')
    W, D = 30.4, 20.3
    part('pcb', [slab((0, 0, T / 2), plate_outline(W, D, 2.5), [circle(sx * 13.3, sy * 8.4, 1.0, 12) for sx in (-1, 1) for sy in (-1, 1)], depth=T)], 'pcb_blue')
    xh('xh', ['pin3', 'pin2', 'pin1'], (13.0, 0.13, 0), rotz=90, side=True)
    bx, by = -9.35, -0.39                            # 6 x 6 switch: black base, steel top plate, round plunger
    part('body', [box((0, 0, T + 1.7), (6.0, 6.0, 3.4))], 'plastic_black', (bx, by, 0))
    part('plate', [box((0, 0, T + 3.55), (6.0, 6.0, 0.3))] + [cyl((sx * 2.1, sy * 2.1, T + 3.72), 0.45, 0.06, 10) for sx in (-1, 1) for sy in (-1, 1)], 'metal', (bx, by, 0))
    part('legs', [box((sx * 2.3, sy * 3.25, T + 0.45), (0.7, 0.9, 0.9)) for sx in (-1, 1) for sy in (-1, 1)], 'metal', (bx, by, 0))
    part('cap', [cyl((0, 0, T + 4.45), 1.75, 1.5, 20)], 'plastic_black', (bx, by, 0))
    anchor('button', (bx, by, T + 5.2))
    part('r_1', [box((0, 0, T + 0.28), (1.6, 2.0, 0.55))], 'chip', (4.37, -5.07, 0))
    part('r_1_ends', [box((0, sy * 1.3, T + 0.3), (1.6, 0.6, 0.6)) for sy in (-1, 1)], 'metal', (4.37, -5.07, 0))
    anchor('r_1', (4.37, -5.07, T + 0.6))
    save()
    return dict(name='Push button', interface='digital',
                dimensions_mm=dict(w=round(W / 2 + 16.5, 2), d=D, h=round(T + 6.05, 2), source='photo',
                                   ref='Robo Coders push button PCB top view + schematic (user, 2026-11-21), scaled from XH pitch ±0.5 mm; 6x6 tactile switch'),
                todo=['tactile switch height 5 mm (6x6x5) assumed from the render'])


def traffic():
    """Robo Coders traffic light module (YUGMINDS layout, 30.3 x 20.2 mm: XH pitch 2.54 mm = 29.5 px -> 11.6 px/mm):
    three 5 mm LEDs standing upright (red, yellow, green left to right) and a side-entry 4-pin XH (R, Y, G, GND from the bottom).
    Schematic: each LED straight from its pin to the common GND, no resistors on the board."""
    new('traffic')
    W, D = 30.3, 20.2
    part('pcb', [slab((0, 0, T / 2), plate_outline(W, D, 2.5), [circle(-12.8, sy * 7.6, 1.0, 12) for sy in (-1, 1)], depth=T)], 'pcb_blue')
    xh('xh', ['pin1', 'pin2', 'pin3', 'pin4'], (13.0, -0.3, 0), rotz=90, color='plastic_yellow', side=True)
    for nm, x, m in (('red', -10.8, 'led_red'), ('yellow', -3.9, 'led_yellow'), ('green', 2.5, 'led_green')):
        top = led5(f'led_{nm}', (x, -0.05), m)
        anchor(nm, (x, -0.05, top))
    save()
    return dict(name='Traffic light module', interface='3 × digital',
                dimensions_mm=dict(w=round(W / 2 + 13.0 + 3.5, 2), d=D, h=round(top, 2), source='photo',
                                   ref='Robo Coders traffic light PCB top view + schematic (user, 2026-11-21), scaled from XH pitch, ±0.5 mm'),
                todo=['5 mm LEDs assumed (footprint outline is Ø4.6 mm, could be 3 mm LEDs), colours red/yellow/green left to right assumed from R-Y-G',
                      'no current-limiting resistors on the board (schematic): the GPIO drives each LED directly'])


def oled():
    """Robo Coders OLED carrier (YUGMINDS layout, 30 x 20 mm: XH pitch 2.54 mm = 29.7 px -> 11.7 px/mm) with a standard
    0.96" I2C OLED module (SSD1306, 27.8 x 27.3 mm) soldered on its 4-pin header, display turned so the header is on the right,
    and a side-entry 4-pin XH (GND, VCC, SCL, SDA top to bottom) facing +X."""
    new('oled')
    W, D = 30.0, 20.0
    part('pcb', [slab((0, 0, T / 2), plate_outline(W, D, 2.5), [circle(-12.7, sy * 7.6, 1.0, 12) for sy in (-1, 1)], depth=T)], 'pcb_blue')
    xh('xh', ['pin1', 'pin2', 'pin3', 'pin4'], (13.0, -0.1, 0), rotz=90, color='plastic_yellow', side=True)
    hx, hy = 1.8, -0.25                              # display header column on the carrier
    pins = [hy + (i - 1.5) * P for i in range(4)]
    part('header', [box((hx, hy, T + 1.25), (2.5, 4 * P, 2.5))], 'plastic_black')
    part('header_pins', [box((hx, y, T + 2.6), (0.64, 0.64, 5.2)) for y in pins], 'gold')
    zb, th = T + 2.5, 1.2                            # display PCB on the header spacer
    xr = hx + 1.6; xl = xr - 27.8; cx = (xl + xr) / 2; zt = zb + th
    part('module', [rrect((cx, hy, zb + th / 2), (27.8, 27.3, th), 1.0)], 'plastic_blue')
    rings = [cyl((cx + sx * 11.9, hy + sy * 11.65, zt + 0.02), 1.6, 0.04, 16) for sx in (-1, 1) for sy in (-1, 1)]
    rings += [cyl((hx, y, zt + 0.02), 0.85, 0.04, 10) for y in pins]
    part('module_pads', rings, 'gold')
    part('module_holes', [cyl((cx + sx * 11.9, hy + sy * 11.65, zt + 0.05), 1.0, 0.06, 12) for sx in (-1, 1) for sy in (-1, 1)], 'plastic_black')
    gx = cx - 0.6
    part('glass', [box((gx, hy, zt + 0.7), (19.3, 26.7, 1.4))], 'plastic_white')
    part('flex', [box((xl + 2.6, hy, zt + 0.08), (3.0, 12.0, 0.16))], 'copper')
    part('screen', [box((gx, hy, zt + 1.425), (10.9, 21.7, 0.05))], 'screen')
    anchor('screen', (gx, hy, zt + 1.45))
    anchor('header', (hx, hy - 6.4, T + 2.5))
    save()
    return dict(name='OLED display (I2C)', interface='I2C',
                dimensions_mm=dict(w=round(16.5 - xl, 2), d=27.3, h=round(T + 6.05, 2), source='photo',
                                   ref='Robo Coders OLED carrier top view (user, 2026-11-21), scaled from XH pitch ±0.5 mm; 0.96" SSD1306 module typical dims'),
                todo=['0.96" module sizes (27.8x27.3, glass 19.3x26.7, active 10.9x21.7) are typical values, confirm',
                      'header spacer height 2.5 mm assumed', 'display colour (white, blue or yellow/blue) unknown: white-blue used'])


def servo():
    """TowerPro SG90 9 g micro servo, as in the user photos: translucent blue case 22.8 x 12.2 x 22.7 mm, mounting tabs 32 mm
    overall (2.5 thick, 15.6 mm up), round boss over the output + smaller bump, white splined shaft (top ~29 mm) with a one-arm
    horn; brown / red / orange lead (GND / VCC / signal) out of the shaft end into a black 3-pin 2.54 mm plug.
    Sizes: SG90 datasheet drawings (Kjell, Rapid 37-1330, TowerPro); sources differ by ±0.6 mm."""
    new('servo')
    L, Wd, H = 22.8, 12.2, 22.7
    bx = L / 2 - 6.1                                 # output shaft axis, under the round boss at the +X end
    part('body', [box((0, 0, H / 2), (L, Wd, H)), cyl((bx, 0, H + 2.0), 6.1, 4.0, 28), cyl((bx - 6.6, 0, H + 1.0), 3.2, 2.0, 20)], 'servo_blue')
    tab = [(-16, -Wd / 2), (16, -Wd / 2), (16, Wd / 2), (-16, Wd / 2)]
    part('tabs', [slab((0, 0, 15.6 + 1.25), tab, [circle(sx * 13.9, 0, 1.0, 10) for sx in (-1, 1)], depth=2.5)], 'servo_blue')
    # inside, seen through the case: nylon gear train under the boss, the motor at the far end
    part('gears', [cyl((bx, 0, H - 2.0), 5.2, 1.4, 20), cyl((bx - 5.6, 0, H - 4.2), 4.0, 1.2, 16), cyl((bx - 1.5, 0, H - 6.4), 4.6, 1.2, 16),
                   cyl((bx - 6.4, 0, H - 8.6), 3.4, 1.2, 14)], 'nylon')
    part('motor', [cyl((-L / 2 + 5.5, 0, 8.0), 3.5, 12.0, 16)], 'metal')
    part('shaft', [cyl((0, 0, H + 4.0 + 1.3), 2.4, 2.6, 12)], 'plastic_white', (bx, 0, 0))
    horn = [cyl((0, 0, 29.3 + 0.8), 3.5, 1.6, 20), box((7.5, 0, 29.3 + 0.8), (15.0, 4.6, 1.4)), cyl((15.0, 0, 29.3 + 0.8), 2.3, 1.4, 14)]
    h = part('horn', horn, 'plastic_white', (bx, 0, 0))
    part('horn_holes', [cyl((x, 0, 31.02), 0.55, 0.06, 8) for x in (5.0, 7.5, 10.0, 12.5, 15.0)], 'chip', parent=h)  # turn with the horn
    anchor('horn', (bx, 0, 31))  # on the hub so the label stays put when the horn turns
    # lead: flat 3-wire ribbon out of the bottom of the +X end, 40 mm to a black 3-pin female plug (2.54 mm)
    x0, xp, zw = L / 2, L / 2 + 40, 1.0
    for nm, y, m in (('gnd', -1.0, 'wire_brown'), ('vcc', 0.0, 'wire_red'), ('signal', 1.0, 'wire_orange')):
        part(f'wire_{nm}', [box(((x0 + xp) / 2, y, zw), (xp - x0, 0.95, 0.95))], m)
        anchor(f'lead_{nm}', (x0, y, zw))  # where the lead leaves the case: lessons draw the real lead from here to the SERVO header
    part('plug', [box((xp + 7.0, 0, 1.3), (14.0, 7.6, 2.6))], 'plastic_black')
    part('plug_holes', [box((xp + 14.02, y, 1.3), (0.04, 1.0, 1.0)) for y in (-P, 0, P)], 'chip')
    for nm, y in (('gnd', -P), ('vcc', 0.0), ('signal', P)):
        anchor(nm, (xp + 14.0, y, 1.3), pin=True)
    save()
    return dict(name='Servo (SG90 micro servo)', interface='PWM',
                dimensions_mm=dict(w=round(xp + 14.0 + 16.0, 2), d=Wd, h=round(29.3 + 1.6, 2), source='datasheet',
                                   ref='TowerPro SG90: case 22.8x12.2x22.7, tabs 32 overall at 15.6 mm, top of shaft ~29 mm (Kjell / Rapid datasheets, ±0.6 mm); photos from the user'),
                todo=['lead drawn 40 mm (real SG90 lead ~25 cm)', 'internal gears and motor are illustrative, sizes not measured'])


def battery():
    """Shrink-wrapped 2-cell pack as in the reference drawing: two small cells side by side under blue film
    (rounded sides, a shallow groove between the cells, folded film at the ends). No built-in lead: a separate 2-pin JST
    cable (jst2) joins it to BAT (user, 2026-11-24); lessons draw that cable from the positive/negative anchors."""
    new('battery')
    R, CL = 5, 36  # 2 x 10440 (AAA-size, Ø10 x 44) assumed, shortened by the film fold
    film = [cyl((x, 0, R), R, CL, 18, 'Y') for x in (-R, R)] + [box((0, 0, R), (2 * R, CL, 2 * R - 1.2))]  # groove: the middle box is a little thinner
    film += [box((0, sy * (CL / 2 + 0.4), R), (4 * R - 2.4, 0.8, 2 * R - 2.4)) for sy in (-1, 1)]               # folded film at both ends
    part('pack', film, 'plastic_blue')
    part('shine', [box((-R - 0.6, 0, 2 * R - 0.02), (1.0, CL - 6, 0.12))], 'plastic_white')                     # film highlight stripe on top
    anchor('cells', (0, 0, 2 * R))
    for nm, x in (('positive', R + 1.6), ('negative', R - 1.0)):  # leads leave the top-end corner, red outside
        anchor(nm, (x, CL / 2 + 0.8, 2 * R - 2.5), pin=True)
    save()
    return dict(name='Battery pack (2-cell)', interface='power',
                dimensions_mm=dict(w=4 * R, d=CL + 1.6, h=2 * R, source='TODO',
                                   ref='shrink-wrapped 2-cell pack from the user reference drawing; 10440 cells assumed for size'),
                todo=['cell type and size unconfirmed (10440 assumed)', 'series/parallel unconfirmed', 'where the 2-pin cable plugs into the pack is not modelled (TODO: socket or wire ends?)'])


def jst_cable(n):
    """JST-XH cable, female plug on both ends (XHP housing, 2.5 mm pitch), wire N straight through to pin N.
    Lying on the desk, latches up: plug A opens toward -X, plug B toward +X, the wires bow gently between them.
    Wire colours follow the cables drawn in the lessons: pin 1 black, pin 2 red, pin 3 orange, pin 4 yellow."""
    new(f'jst{n}')
    W, PL, PH, L, BOW = (n - 1) * P + 4.9, 9.5, 4.6, 100.0, 10.0  # housing width/length/height, plug-to-plug run, bow
    colors = ['wire_black', 'wire_red', 'wire_orange', 'wire_yellow']
    for end, sx in (('a', -1), ('b', 1)):
        cx = sx * (L / 2 + PL / 2)                    # mating face outward, wires leave the inner (back) face
        face = cx + sx * PL / 2
        part(f'plug_{end}', [box((cx, 0, PH / 2), (PL, W, PH)),
                             box((cx + sx * (PL / 2 - 2.0), 0, PH + 0.45), (2.4, 2.6, 0.9)),            # latch ramp
                             box((cx - sx * (PL / 2 - 0.6), 0, PH / 2), (1.2, W + 0.6, PH + 0.4))],   # crimp-side collar
             'plastic_white')
        part(f'plug_{end}_holes', [box((face + sx * 0.01, (i - (n - 1) / 2) * P, PH / 2 - 0.3), (0.04, 1.1, 1.4)) for i in range(n)], 'chip')
        anchor(f'plug_{end}', (cx, 0, PH + 0.9))
        for i in range(n):
            anchor(f'{end}_pin{i + 1}', (face, (i - (n - 1) / 2) * P, PH / 2 - 0.3), pin=True)
    K, z = 40, 1.6                                     # samples along the run; wire centre height
    for i in range(n):
        off = i - (n - 1) / 2
        pts = []
        for k in range(K + 1):
            u = k / K
            spread = 1.5 + (P - 1.5) * (math.cos(2 * math.pi * u) + 1) / 2   # pitch at the plugs, touching in the middle
            pts.append((-L / 2 - 1.0 + (L + 2.0) * u, BOW * math.sin(math.pi * u) ** 2 + off * spread, z))
        part(f'wire_{i + 1}', [tube(pts, 0.7)], colors[i])
    anchor('wires', (0, BOW + (n - 1) / 2 * 1.5 + 0.7, z))
    save()
    return dict(name=f'{n}-pin JST cable', interface='cable',
                dimensions_mm=dict(w=round(L + 2 * PL, 2), d=round((W + 0.6) / 2 + BOW + (n - 1) / 2 * 1.5 + 0.7, 2),  # plug side to the top of the bow
                                   h=round(PH + 0.9, 2), source='datasheet',
                                   ref='JST XH series: 2.5 mm pitch, XHP housing width = 2.5 x (pins - 1) + 4.9 mm (JST XH catalogue); housing length and height typical'),
                pins={f'anchor_jst{n}_{e}_pin{i + 1}': f'Pin {i + 1}: {colors[i][5:]} wire, straight through to pin {i + 1} at the other end' for e in 'ab' for i in range(n)},
                todo=['cable drawn 100 mm between the plugs: real length TODO (kit cables often 20 cm)', 'wire colours follow the lesson drawings; confirm the kit cables'])


TT_GB = (37, 18.8, 22.5)  # TT gearbox: length (X) x thickness along the shaft (Y) x height (Z)


def tt_motor():
    """TT gear motor (1:48), as in the kit photos: yellow two-half gearbox with a mounting ear at the shaft end,
    white double-flat output shaft out of both faces, two M3 mounting holes 20 mm behind the shaft (17.5 mm apart),
    a yellow collar holding the flat-sided silver can, a milky end cap with its bearing and two brass terminals.
    Origin: under the shaft, gearbox mid-thickness, on the floor. Shaft along Y, motor can toward -X."""
    new('tt_motor')
    L, T, H = TT_GB
    zs = H / 2                                                   # shaft height = gearbox mid-height
    dshape = lambda r, flat, n=16: [(max(-flat, min(flat, r * math.cos(2 * math.pi * k / n))), r * math.sin(2 * math.pi * k / n)) for k in range(n)]
    half = (L, (T - 0.6) / 2, H)  # two moulded halves with a seam between them
    gb = part('gearbox', [box((-7.5, sy * (T + 0.6) / 4, H / 2), half) for sy in (-1, 1)] + [box((-7.5, 0, H / 2), (L - 0.8, 0.7, H - 0.8)),
                          slab((0, 0, 0), [(11, 3)] + [(14 + 4 * math.cos(math.radians(a)), 7 + 4 * math.sin(math.radians(a))) for a in range(-90, 91, 45)] + [(11, 11)],
                               [circle(14.6, 7, 1.5, 6)], 3, 'XZ'),                  # mounting ear with its hole
                          cyl((-29, 0, zs), 10.4, 6, 16, 'X')], 'plastic_yellow')    # collar round the can
    part('holes', [cyl((-20, sy * (T / 2 + 0.05), 12 + dz), 1.6, 0.25, 8, 'Y') for sy in (-1, 1) for dz in (-8.75, 8.75)]   # M3 mounting holes
         + [cyl((x, sy * (T / 2 + 0.05), z), 1.1, 0.25, 8, 'Y') for sy in (-1, 1) for x, z in ((6, 3.5), (6, 19), (-24, 11.25))], 'plastic_black', parent=gb)  # case screws
    part('motor', [slab((-38, 0, zs), dshape(10, 7.5), (), 24, 'YZ')], 'metal', parent=gb)                                  # flat-sided can, 20 x 15
    part('end_cap', [slab((-52.5, 0, zs), dshape(9.6, 7.2), (), 5, 'YZ'), cyl((-55.7, 0, zs), 2.6, 1.4, 12, 'X')], 'cap_clear', parent=gb)
    part('shaft', [slab((0, 0, 0), dshape(2.7, 1.85, 12), (), T + 19, 'XZ')], 'plastic_white', (0, 0, zs))  # Ø5.4, flats 3.7 apart, 9.5 out of each face
    anchor('shaft', (0, T / 2 + 9.5, zs))
    anchor('motor', (-38, 0, zs + 10))
    for i, y in enumerate((3.5, -3.5)):
        part(f'terminal_{i + 1}', [box((0, 0, 1.5), (1.4, 2.6, 3))], 'brass', (-53, y, zs + 9.6), key='term', parent=gb)
        anchor(f'terminal_{i + 1}', (-53, y, zs + 12.6), pin=True)
    save()
    return dict(name='TT gear motor', interface='DC motor',
                dimensions_mm=dict(w=74.4, d=T + 19, h=round(zs + 12.6, 2), source='listing', ref='TT motor 70 x 22 x 18 mm (listings); gearbox 37 x 18.8 x 22.5, shaft Ø5.4 with flats 3.7 apart, holes 2 x Ø3 17.5 apart 20 mm behind the shaft'),
                todo=['ear, collar and end-cap sizes from photos', 'wires not modelled (the site draws the cables)'])


WHEEL_R, WHEEL_W = 32.5, 26  # common 65 mm TT-motor wheel — TODO confirm against the kit's wheels


def wheel_assembly(name, at):
    """TT wheel as in the photo: hollow rubber tyre with rounded shoulders and two staggered tread rows,
    lemon-yellow rim with a lip, 5-arm star and a hub with a shaft hole. Node `name` on the axle (Y); rim faces +Y."""
    R = WHEEL_R
    tyre_prof = [(21.5, -12), (27, -13), (30, -12.4), (31.2, -10.5), (31.5, -6), (31.5, 6), (31.2, 10.5), (30, 12.4), (27, 13), (21.5, 12)]
    blocks = [boxr((math.cos(a) * (R - 0.8), y, math.sin(a) * (R - 0.8)), (1.6, 8.6, 5.6), -a)  # box local X is radial after the turn
              for row, y in enumerate((-5.6, 5.6)) for a in [(k + 0.5 * row) * 2 * math.pi / 22 for k in range(22)]]
    shoulders = [boxr((math.cos(a) * (R - 3.2), y, math.sin(a) * (R - 3.2)), (3.2, 2.2, 4.6), -a)  # shoulder blocks wrapping onto the sidewall
                 for y in (-11.9, 11.9) for a in [(k + 0.25) * 2 * math.pi / 22 for k in range(22)]]
    tyre = part(name, [lathe((0, 0, 0), tyre_prof, 40)] + blocks + shoulders, 'rubber', at, key='tyre')
    rim = [lathe((0, 0, 0), [(19.5, -10), (21.6, -10), (21.6, 11), (22.6, 11), (22.6, 12.4), (19.5, 12.4)], 40),
           lathe((0, 0, 0), [(2.6, -9), (7, -9), (7, 11), (2.6, 11)], 20)]
    for k in range(5):  # star arms, tapered: wide near the hub, narrower at the rim, dished toward the outer face
        a = k * 2 * math.pi / 5 + math.pi / 2
        rim += [boxr((math.cos(a) * 10.5, 8.5, math.sin(a) * 10.5), (8, 5, 9.4), -a),     # wide flat arms as in the photo
                boxr((math.cos(a) * 16.5, 9.5, math.sin(a) * 16.5), (7, 3.6, 7.6), -a)]
    part(f'{name}_rim', rim, 'rim_yellow', (0, 0, 0), key='rim', parent=tyre)
    return tyre


def wheel():
    new('wheel')
    wheel_assembly('tyre', (0, 0, WHEEL_R))
    anchor('tread', (0, 0, 2 * WHEEL_R))
    anchor('hub', (0, WHEEL_W / 2, WHEEL_R))
    save()
    return dict(name='Wheel (65 mm, TT motor)', interface='mechanical',
                dimensions_mm=dict(w=2 * WHEEL_R, d=WHEEL_W, h=2 * WHEEL_R, source='photo', ref='common TT-motor wheel, 65 x 26 mm; shape from the chassis photo'),
                todo=['diameter and width assumed (65 x 26 mm)', 'tread blocks and star arms simplified from the photo'])


def kit_plate(L=255, W=148, Bh=50, well=(36, 104), seg=10):
    """Outline of the common 4WD smart-car plate (both decks are the same part): curved front/rear bumpers at full width,
    a wheel well on each side of each axle (body narrows to 2*Bh there), a full-width tab in the middle of each side,
    and a notch at the well edge for each outer motor fixing piece (for either motor orientation)."""
    W2, (w0, w1) = W / 2, well
    s_ = L / 2 - w1                                  # bumper depth (arc sagitta)
    R = (W2 ** 2 + s_ ** 2) / (2 * s_)
    th = math.asin(W2 / R)
    def bumper(sign):                                # arc from y=-W2 to +W2 (front) or back (rear)
        cx = sign * (L / 2 - R)
        a = [(-th + 2 * th * k / seg) for k in range(seg + 1)]
        return [(cx + sign * R * math.cos(t), sign * R * math.sin(t)) for t in a]
    NOTCH = (10.6, 3.4)
    def side(sign):                                  # top (+y, sign=1, going -x) or bottom (-y, going +x) edge
        pts = []
        for x0, x1 in ((w1, w0), (-w0, -w1)) if sign > 0 else ((-w1, -w0), (w0, w1)):
            pts += [(x0, sign * W2), (x0, sign * Bh)]
            for nx in sorted((x for x in (50, 90, -50, -90) if min(x0, x1) < x < max(x0, x1)), key=lambda x: -sign * x):
                a, b = nx + sign * NOTCH[0] / 2, nx - sign * NOTCH[0] / 2
                pts += [(a, sign * Bh), (a, sign * (Bh - NOTCH[1])), (b, sign * (Bh - NOTCH[1])), (b, sign * Bh)]
            pts += [(x1, sign * Bh), (x1, sign * W2)]
        return pts
    pts = bumper(1) + side(1) + bumper(-1) + side(-1)
    pts = [p for i, p in enumerate(pts) if math.dist(p, pts[i - 1]) > 1e-6]  # arcs and edges share their end points
    return pts, R, L / 2 - R


def chassis():
    """4WD acrylic chassis, modelled on the common '4WD smart car chassis' kit (two identical 255 x 148 mm plates,
    6 M3 x 30 brass standoffs, 8 motor fixing pieces, 8 M3 x 30 bolts + nuts, 4 TT motors, 4 x 65 mm wheels).
    Front = +X. Left side = +Y (motor channel A), right = -Y (channel B). Origin on the floor, centred.
    Assembly: motors stand ON the bottom plate; two T-shaped fixing pieces per motor are pushed up from underneath
    (inner one through a slot, outer one into the notch at the wheel well); two M3 x 30 bolts go through
    piece, gearbox and piece (heads on the wheel side) with a nut on each; the wheels push onto the shafts."""
    new('chassis')
    L, W, Bh, t, gap = 255, 148, 50, 3, 30
    ax = 70                      # wheel axle x (front/back): wheelbase 140
    zc = WHEEL_R                 # axle height
    GB = TT_GB
    zd = zc - GB[2] / 2          # bottom plate top: the shaft is at the gearbox's mid-height
    SO = [(sx * 110, sy * 50) for sx in (-1, 1) for sy in (-1, 1)] + [(0, 64), (0, -64)]  # 6 standoffs: bumper corners + side tabs
    MOT = (('fl', 1, 1), ('fr', 1, -1), ('rl', -1, 1), ('rr', -1, -1))
    SLOT = (10.6, 3.4)           # fixing-piece stem 10 x 3 plus clearance
    y_in = Bh - 4.5 - GB[1]      # inner fixing-piece line (outer piece sits in the well-edge notch)
    hole = lambda x, y, r=1.6: circle(x, y, r, 6 if r < 2 else 12)  # M3 clearance, 3.2 mm (6 sides is enough at this size)
    cross = lambda x, y, a=6, b=2: [(x + u, y + v) for u, v in ((b, b), (b, a), (-b, a), (-b, b), (-a, b), (-a, -b), (-b, -b), (-b, -a), (b, -a), (b, -b), (a, -b), (a, b))]
    outline, R, cx = kit_plate(L, W, Bh)
    def arc_slot(sign, y0, y1, r, w=4, n=4):         # curved slot following the bumper
        ang = lambda y, rr: math.asin(y / rr)
        rr0, rr1 = r - w / 2, r + w / 2
        pts = [(sign * cx + sign * rr1 * math.cos(ang(y0 + (y1 - y0) * k / n, rr1)), y0 + (y1 - y0) * k / n) for k in range(n + 1)]
        pts += [(sign * cx + sign * rr0 * math.cos(ang(y1 - (y1 - y0) * k / n, rr0)), y1 - (y1 - y0) * k / n) for k in range(n + 1)]
        return pts if sign > 0 else pts[::-1]
    holes = ([hole(x, y) for x, y in SO]
             + [hole(sx * 42.5, sy * 47.8) for sx in (-1, 1) for sy in (-1, 1)]          # base board (its M3 holes, board turned 90 deg)
             + [rect(x, sy * y_in, *SLOT) for x in (-90, -50, 50, 90) for sy in (-1, 1)]   # inner fixing-piece slots (both motor orientations)
             + [cross(sx * 62, sy * 12) for sx in (-1, 1) for sy in (-1, 1)]              # cross cut-outs (wires / accessories)
             + [hole(sx * 112, 0, 6) for sx in (-1, 1)]                                      # big round holes (switch / wires)
             + [oblong(0, 0, 30, 9)] + [hole(0, sy * 36) for sy in (-1, 1)] + [hole(sx * 20, sy * 64) for sx in (-1, 1) for sy in (-1, 1)]
             + [hole(118, sy * 13) for sy in (-1, 1)]                                        # sensor holder
             + [arc_slot(sx, y0, y1, R - 7) for sx in (-1, 1) for y0, y1 in ((-46, -18), (18, 46))])
    plate = [slab((0, 0, 0), outline, holes, t)]
    part('plate_bottom', plate, 'acrylic', (0, 0, zd - t / 2), key='plate')
    part('plate_top', plate, 'acrylic', (0, 0, zd + gap + t / 2), key='plate')
    # motor fixing piece (used upside down): crossbar 18 x 5 under the plate, stem 10 wide up through it, two M3 holes 17.5 mm apart
    zb0, zb1, ztop = zd - t - 5, zd - t, zd + 24
    T_OUT = [(-9, zb0), (9, zb0), (9, zb1), (5, zb1)] + [(5 * math.cos(math.radians(a)), ztop - 5 + 5 * math.sin(math.radians(a))) for a in range(0, 181, 30)] + [(-5, zb1), (-9, zb1)]
    T_HOLES = [circle(0, zd + 12 + dz, 1.6) for dz in (-8.75, 8.75)]
    for i, (x, y) in enumerate(SO):  # M3 x 30 male-female: hex body between the plates, stud down through the bottom plate (nut under it)
        part(f'standoff_{i + 1}', [cyl((0, 0, zd + gap / 2), 3.2, gap, 6), cyl((0, 0, zd - 3), 1.5, 6, 8)], 'brass', (x, y, 0), key='standoff')
    for nm, sx, sy in MOT:
        y = sy * (Bh - 3 - GB[1] / 2)        # gearbox between the outer piece (well notch) and the inner one
        x, gx = sx * ax, sx * (ax - 20)      # shaft x; mounting holes 20 mm behind the shaft
        # TT motor (tt_motor.glb, mounted by the site) stands on the plate here: gearbox at the wheel well, can toward the centre
        anchor(f'motor_mount_{nm}', (x, y, zd))
        for side, yy in (('out', sy * (Bh - 1.5)), ('in', sy * y_in)):
            part(f'bracket_{nm}_{side}', [slab((0, 0, 0), T_OUT, T_HOLES, 3, 'XZ')], 'acrylic', (gx, yy, 0), key='tbracket')
            anchor(f'bracket_{nm}_{side}', (gx, yy, zd + 24))
        for k, dz in enumerate((-8.75, 8.75)):  # two holes 17.5 mm apart: bolt head outside, nut inside
            anchor(f'bolt_{nm}_{k + 1}', (gx, sy * Bh, zd + 12 + dz))
            anchor(f'nut_{nm}_{k + 1}', (gx, sy * (Bh - 6 - GB[1]), zd + 12 + dz))
        anchor(f'axle_{nm}', (x, sy * (Bh + 16), zc))  # wheel.glb centre (26 wide: inner face 3 mm clear of the bolt heads)
        anchor(f'motor_{nm}', (x - sx * 53, y, zd + GB[2] / 2 + 12.6))   # motor terminals on the end cap
    top = zd + gap + t
    anchor('mount', (0, 0, top))
    save()
    return dict(name='4WD robot chassis', interface='mechanical',
                dimensions_mm=dict(w=L, d=W, h=round(top - zb0, 2), source='listing',
                                   ref='common 4WD smart-car chassis kit: plates 255 x 148 mm (seller listings), car ~256 x 155 x 66 mm; TT motor 70 x 22 x 18; wheels 65 x 26'),
                todo=['motors are tt_motor.glb and wheels are wheel.glb, mounted on the motor_mount / axle anchors by the site', 'plate thickness 3 mm assumed (listings say 2-5 mm)', 'cut-out positions drawn from product photos, not a drawing',
                      'fixing-piece shape approximate; TT holes 17.5 mm apart, 20 mm behind the shaft', 'standoffs 30 mm (some kits ship 40 mm)'])


def jr_board():
    """Robo Coders JR. EXPLORER KIT non-programmable board (EasyEDA top view + schematic, user 2026-11-22).
    81.3 x 50.7 mm: XH pitch 2.54 mm = 29.6 px -> 11.63 px/mm (the DIP-16 pins agree). L293D (U1) passes each input IPn to
    output OPn, which drives the OPn port, LEDn (shared R1 1k) and the motor connectors CN2 LEFT MOTOR (OP1/OP2) and CN1 RIGHT MOTOR (OP3/OP4).
    PLED sits right of the NON-PROGRAMMABLE BOARD text (revised layout + render, user 2026-11-23).
    Power: DC jack U3 or CN3 -> SW1 -> 7805 (U2, TO-252) -> 5 V; PLED through R2."""
    new('jr_board')
    W, D = 81.3, 50.7
    part('pcb', [slab((0, 0, T / 2), plate_outline(W, D, 3.0), [circle(sx * 37.0, sy * 22.0, 1.6, 12) for sx in (-1, 1) for sy in (-1, 1)], depth=T)], 'pcb_blue')
    for n, x in enumerate((-9.30, 3.22, 15.35, 27.60), 1):          # OP1..OP4 along the top edge, pins: 5V, GND, signal
        xh(f'op{n}', [f'op{n}_pin{k}' for k in (1, 2, 3)], (x, 19.7, 0))
    for n, x in enumerate((-10.19, 2.05, 14.19, 26.30), 1):         # IP1..IP4 along the bottom edge
        xh(f'ip{n}', [f'ip{n}_pin{k}' for k in (1, 2, 3)], (x, -19.82, 0))
    for n, x in enumerate((-0.52, 6.69, 14.03, 21.28), 1):          # LED1..LED4: red 5 mm, upright, one per output
        top = led5(f'led{n}', (x, 10.64), 'led_red')
        anchor(f'led{n}', (x, 10.64, top))
    for nm, y in (('cn1', 6.1), ('cn2', -8.99)):                    # motor connectors: CN1 RIGHT MOTOR = OP3/OP4, CN2 LEFT MOTOR = OP1/OP2
        xh(nm, [f'{nm}_pin1', f'{nm}_pin2'], (31.3, y, 0), rotz=90)
    xh('cn3', ['cn3_pin1', 'cn3_pin2'], (-34.57, -1.22, 0), rotz=90)  # BAT: battery input (in parallel with the DC jack)
    # U1 L293D, DIP-16, pin 1 bottom-left (square pad); rows 8.9 mm apart in this footprint
    ux, uy = 2.06, -6.16
    part('u1', [box((ux, uy, T + 0.5 + 1.65), (20.3, 6.4, 3.3))], 'chip')
    part('u1_notch', [cyl((ux - 10.15, uy, T + 3.82), 1.0, 0.06, 12)], 'plastic_grey')
    legs = []
    for i in range(8):
        x = ux + (i - 3.5) * P
        for sy in (-1, 1):
            legs.append(box((x, uy + sy * 3.9, T + 0.95), (0.5, 1.4, 1.9)))   # ponytail: one block per leg (gull bend not modelled), keeps the board under 5k tris
    part('u1_legs', legs, 'metal')
    anchor('u1', (ux, uy, T + 3.8))
    # C3 100 uF electrolytic (6.3 x 7 mm)
    part('c3', [cyl((18.03, -6.16, T + 3.5), 3.15, 7.0, 20)], 'plastic_grey')
    part('c3_top', [cyl((18.03, -6.16, T + 7.02), 2.9, 0.06, 20), box((15.9, -6.16, T + 3.5), (1.0, 3.0, 6.6))], 'metal')
    anchor('c3', (18.03, -6.16, T + 7.0))
    # U2 7805 regulator, TO-252: tab to the left, two leads to the right
    part('u2', [box((-32.6, 15.8, T + 1.15), (6.1, 6.5, 2.3))], 'chip')
    part('u2_tab', [box((-36.2, 15.8, T + 0.25), (5.2, 6.0, 0.5))], 'metal')
    part('u2_legs', [box((-28.9, y, T + 0.4), (1.6, 0.8, 0.5)) for y in (18.15, 13.5)], 'metal')
    anchor('u2', (-32.6, 15.8, T + 2.3))
    # SW1 KFC5858 latching power switch and its cap
    part('sw1', [box((-34.44, 7.67, T + 2.0), (5.8, 5.8, 4.0))], 'plastic_grey')
    part('sw1_cap', [box((-34.44, 7.67, T + 4.75), (2.5, 2.5, 1.5))], 'plastic_white')
    anchor('sw1', (-34.44, 7.67, T + 5.5))
    # U3 DC barrel jack on the left edge, opening -X
    part('u3', [box((-35.0, -12.6, T + 5.5), (14.0, 9.0, 11.0))], 'plastic_black')
    part('u3_hole', [cyl((-42.03, -12.6, T + 6.5), 3.2, 0.06, 20, 'X')], 'chip')
    part('u3_pin', [cyl((-41.0, -12.6, T + 6.5), 1.0, 2.0, 10, 'X')], 'metal')
    anchor('u3', (-42.1, -12.6, T + 6.5))
    # SMD parts: C1, C2, R2, PLED, R1, C4, C5 (1206)
    for nm, x, y, rz, m in (('c1', -28.82, 10.0, 90, 'smd_tan'), ('c2', -28.28, 21.07, 0, 'smd_tan'), ('r2', -28.95, 3.91, 90, 'chip'),
                            ('pled', -11.1, 9.6, 90, 'led_clear'), ('r1', 17.28, 0.95, 90, 'chip'), ('c4', 38.68, -8.73, 90, 'smd_tan'), ('c5', 38.4, 12.95, 90, 'smd_tan')):
        smd(nm, (x, y, 0), (3.2, 1.6, 0.6), m, rotz=rz)
        anchor(nm, (x, y, T + 0.6))
    save()
    return dict(name='Jr. Explorer board', interface='non-programmable (L293D)',
                dimensions_mm=dict(w=round(42.06 + W / 2, 2), d=D, h=round(T + 11.0, 2), source='photo',
                                   ref='JR. EXPLORER KIT PCB top view, 3D render and schematic (user, 2026-11-22), scaled from the XH pitch ±0.5 mm'),
                todo=['L293D ENABLE1/2 assumed tied high (always on); schematic image is too small to read those nets',
                      'IPn -> INPUTn mapping read from net labels: confirm IP1..IP4 -> L293D pins 2, 7, 10, 15',
                      'DC jack, SW1 and C3 sizes are typical'])


def egg(c, rx, rz, n=8, seg=16, axis='Z'):
    """Smooth ellipsoid of revolution: radius rx round the axis, half-length rz along it."""
    return lathe(c, [(rx * math.sin(math.pi * k / n), rz * math.cos(math.pi * k / n)) for k in range(n + 1)], seg, axis, smooth=True)


def cat():
    """Cat sprite for the Scratch lessons: an original four-legged cartoon cat (not the Scratch Cat, a Scratch Foundation
    trademark). Faces +X, which is Scratch direction 90. Origin: on the floor under the body. `cat_tail` pivots at its root."""
    new('cat')
    for x in (26, -24):                                                     # legs, paws a little forward
        for y in (13, -13):
            nm = f'{"f" if x > 0 else "r"}{"l" if y > 0 else "r"}'
            part(f'leg_{nm}', [cyl((0, 0, 14), 7, 24, 12)], 'fur_orange', (x, y, 0), key='leg')    # shared mesh: shape local, placed by `at`
            part(f'paw_{nm}', [egg((3, 0, 5.5), 7.5, 5.5, 5, 10)], 'fur_cream', (x, y, 0), key='paw')
    part('body', [egg((0, 0, 40), 23, 36, 10, 20, '-X'), egg((34, 0, 56), 15, 12)], 'fur_orange')   # body + neck
    part('chest', [egg((24, 0, 40), 15, 15)], 'fur_cream')
    part('head', [egg((38, 0, 76), 27, 24, 11, 22)], 'fur_orange')
    part('stripes', [box((x, 0, z), (3.4, 12, 2.6)) for x, z in ((31, 98.3), (38, 99.4), (45, 98.6))], 'fur_dark')
    part('muzzle', [egg((58, y, 68), 10, 8, 6, 12) for y in (7, -7)], 'fur_cream')
    part('nose', [egg((67, 0, 73), 3.5, 2.8, 6, 10)], 'nose_pink')
    part('eyes', [egg((58, y, 82), 8.5, 10, 7, 12) for y in (11, -11)], 'eye_white')
    part('pupils', [egg((63, y, 82.5), 4, 5, 6, 10) for y in (11.5, -11.5)], 'eye_black')
    part('glints', [egg((66.2, y, 85), 1.3, 1.3, 3, 6) for y in (10, -13)], 'eye_white', key='glint')
    part('ears', [cyl((34, y, 98), 11, 26, 12, 'Z', 0.5) for y in (15, -15)], 'fur_orange')
    part('ears_inner', [cyl((38.5, y, 97), 6.5, 18, 12, 'Z', 0.3) for y in (15, -15)], 'nose_pink')
    part('whiskers', [tube([(64, s * 9, z0), (75, s * 25, z1)], 0.5, 4) for s in (1, -1) for z0, z1 in ((71, 74), (69, 68), (67, 62))], 'fur_dark')
    part('collar', [lathe((34, 0, 56), [(15.5 + 2.8 * math.cos(2 * math.pi * k / 6), 2.8 * math.sin(2 * math.pi * k / 6)) for k in range(6)], 20, 'Z', smooth=True)], 'collar_blue')
    part('bell', [egg((50, 0, 52), 4, 4, 6, 10)], 'gold')
    tail = part('tail', [tube([(0, 0, 0), (-12, 0, 4), (-20, 0, 14), (-22, 0, 28), (-17, 0, 40), (-10, 0, 45)], 4.5, 8)], 'fur_orange', (-33, 0, 46))
    part('tail_tip', [egg((-10, 0, 45), 4.7, 4.7, 6, 10)], 'fur_cream', parent=tail)
    anchor('head', (40, 0, 100))
    anchor('body', (0, 0, 63))
    save()
    return dict(name='Cat sprite', interface='Scratch sprite',
                dimensions_mm=dict(w=134.88, d=52.91, h=111, source='design', ref='original cartoon cat for the Scratch lessons; one Scratch step = 1 mm'),
                todo=['design approval: an original cat, not the Scratch Cat'])


MODELS = {'esp32': esp32, 'tb6612': tb6612, 'base': base, 'ultrasonic': ultrasonic, 'dht11': dht11, 'ldr': ldr,
          'button': button, 'touch': touch, 'ir': ir, 'mic': mic, 'soil': soil, 'rain': rain, 'buzzer': buzzer,
          'led': led, 'traffic': traffic, 'oled': oled, 'gas': gas, 'servo': servo, 'battery': battery,
          'tt_motor': tt_motor, 'wheel': wheel, 'chassis': chassis, 'jr_board': jr_board, 'jst2': lambda: jst_cable(2), 'jst3': lambda: jst_cable(3), 'jst4': lambda: jst_cable(4), 'cat': cat}


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    ids = argv or list(MODELS)
    path = os.path.join(MODELS_DIR, 'manifest.json')
    try:
        with open(path) as f:
            manifest = {e['id']: e for e in json.load(f)}
    except (FileNotFoundError, ValueError):
        manifest = {}
    for mid in ids:
        meta = MODELS[mid]()
        old = manifest.get(mid, {})
        manifest[mid] = dict(id=mid, name=meta['name'], file=f'models/{mid}.glb', source=f'models/{mid}.blend',
                             dimensions_mm=meta['dimensions_mm'], anchors=list(ANCHORS),
                             interface=meta['interface'], voltage=old.get('voltage', 'TODO'),
                             pins={a: old.get('pins', {}).get(a) or meta.get('pins', {}).get(a, '') for a in PINS}, todo=meta.get('todo', []),
                             status=old.get('status', 'draft'))
        print(f'built {mid}: {len(ANCHORS)} anchors')
    order = [m for m in MODELS if m in manifest] + [m for m in manifest if m not in MODELS]
    with open(path, 'w') as f:
        json.dump([manifest[m] for m in order], f, indent=2)


main()
