"""Fit real G9 Starter Essentials clothing and Pixie strand data to Mitsuki."""
import bpy,json,gzip,math
from pathlib import Path
from urllib.parse import unquote
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'assets/source-models/genesis9-starter/Content'
OUT=ROOT/'assets/mitsuki'
def read(p):
    b=p.read_bytes();return json.loads(gzip.decompress(b) if b[:2]==b'\x1f\x8b' else b)
def resolve(url):return BASE/unquote(url.split('#')[0]).lstrip('/')
def xyz(v):return Vector((v[0]*.01,-v[2]*.01,v[1]*.01))
bpy.ops.wm.open_mainfile(filepath=str(OUT/'mitsuki_source_v01.blend'))
rig=bpy.data.objects['Mitsuki_Rig'];body=bpy.data.objects['Mitsuki_Body']
for ob in list(bpy.data.objects):
    if ob.name.startswith('FITTING_ONLY'):bpy.data.objects.remove(ob,do_unlink=True)
col=bpy.data.collections['10_WARDROBE']
haircol=bpy.data.collections.new('03_STARTER_PIXIE_HAIR');bpy.context.scene.collection.children.link(haircol)
raw=[v.co.copy() for v in body.data.vertices];final=[v.copy() for v in raw]
for key in list(body.data.shape_keys.key_blocks)[1:]:
    for i,v in enumerate(key.data):final[i]+=(v.co-raw[i])*key.value
body.data.calc_loop_triangles();tris=[tuple(t.vertices) for t in body.data.loop_triangles]
bvh=BVHTree.FromPolygons(raw,tris,all_triangles=True)
def fit(p):
    hit,n,idx,dist=bvh.find_nearest(p);ids=tris[idx]
    delta=barycentric_transform(hit,*(raw[i] for i in ids),*(final[i]-raw[i] for i in ids))
    return p+delta

def material(name,sm):
    m=bpy.data.materials.new(name);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF')
    ch=sm.get('diffuse',{}).get('channel',{});color=ch.get('current_value',[.12,.07,.04])
    if 'Pixie' in name:color=[.055,.027,.012]
    bs.inputs['Base Color'].default_value=(*color,1);m.diffuse_color=(*color,1);bs.inputs['Roughness'].default_value=.9
    bs.inputs['Specular IOR Level'].default_value=.16
    path=ch.get('image_file')
    if path:
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(resolve(path)),check_existing=True)
        m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    return m
report={'source':'Genesis 9 Starter Essentials','parts':{},'fitting':'Nearest-triangle barycentric transfer of Mitsuki base displacement; source clothing weights retained. Hair strands follow the fitted root and head bone.','limitations':['dForce dynamics and Iray strand shaders are not converted.','Static first fit; extreme poses and wardrobe collisions not production validated.']}

def meshpart(label,g,d,preset,target):
    verts=[xyz(v) for v in g['vertices']['values']];faces=g['polylist']['values']
    mesh=bpy.data.meshes.new(label);mesh.from_pydata([fit(v) for v in verts],[],[f[2:] for f in faces]);mesh.update()
    ob=bpy.data.objects.new(label,mesh);target.objects.link(ob)
    uv=read(resolve(g['default_uv_set']))['uv_set_library'][0];uvs=uv['uvs']['values'];over={(p,v):u for p,v,u in uv.get('polygon_vertex_indices',[])}
    layer=mesh.uv_layers.new(name='UVMap')
    for p in mesh.polygons:
        p.material_index=faces[p.index][1];p.use_smooth=True
        for li in p.loop_indices:
            vi=mesh.loops[li].vertex_index;layer.data[li].uv=uvs[over.get((p.index,vi),vi)]
    mats={gr:sm for sm in preset['scene']['materials'] for gr in sm.get('groups',[])}
    for gr in g['polygon_material_groups']['values']:
        mesh.materials.append(material(label+' | '+gr,mats.get(gr,{})))
    if label=='G9_Pixie_Cap':
        for m in mesh.materials:
            tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(BASE/'Runtime/Textures/DAZ/G9SE/dForcePixieHair/dForcePixieCap_Opacity.png'),check_existing=True)
            tex.image.colorspace_settings.name='Non-Color';m.node_tree.links.new(tex.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Alpha'])
    skin=next((m['skin'] for m in d.get('modifier_library',[]) if 'skin' in m),None)
    if skin:
        for j in skin['joints']:
            bone=j['node'].split('#')[-1]
            if bone not in rig.data.bones:continue
            vg=ob.vertex_groups.new(name=bone)
            for i,w in j.get('node_weights',{}).get('values',[]):vg.add([i],w,'REPLACE')
    else:
        vg=ob.vertex_groups.new(name='head');vg.add(list(range(len(verts))),1,'REPLACE')
    mod=ob.modifiers.new('Shared Mitsuki skeleton','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=True
    mod=ob.modifiers.new('Garment smoothing','SUBSURF');mod.levels=1;mod.render_levels=2
    if label!='G9_Pixie_Cap':
        mod=ob.modifiers.new('Mitsuki surface clearance','SHRINKWRAP');mod.target=body;mod.wrap_method='NEAREST_SURFACEPOINT';mod.wrap_mode='OUTSIDE';mod.offset=.006
        mod=ob.modifiers.new('Fabric thickness','SOLIDIFY');mod.thickness=.002;mod.offset=1
    ob.parent=rig
    report['parts'][label]={'vertices':len(verts),'faces':len(faces),'separate_object':True}
    return ob

for item in ['Shirt','Shorts']:
    preset=read(BASE/('People/Genesis 9/Clothing/Daz Originals/Base Clothing/G9 Base '+item+'.duf'))
    geo=next(n['geometries'][0] for n in preset['scene']['nodes'] if n.get('geometries'))
    d=read(resolve(geo['url']));g=d['geometry_library'][0]
    meshpart('G9_Base_'+item,g,d,preset,col)

preset=read(BASE/'People/Genesis 9/Hair/Daz Originals/Base Hair/G9 Base dForce Pixie Hair.duf')
for node in preset['scene']['nodes']:
    for geo in node.get('geometries',[]):
        d=read(resolve(geo['url']));g=d['geometry_library'][0]
        if g['polylist']['count']:
            meshpart('G9_Pixie_Cap',g,d,preset,haircol)
        else:
            points=[xyz(p) for p in g['vertices']['values']]
            curves=bpy.data.curves.new('G9_Pixie_Original_Strands','CURVE');curves.dimensions='3D';curves.bevel_depth=.000065;curves.bevel_resolution=0;curves.resolution_u=1
            mats={gr:sm for sm in preset['scene']['materials'] for gr in sm.get('groups',[])}
            for gr in g['polygon_material_groups']['values']:curves.materials.append(material('Pixie | '+gr,mats.get(gr,{})))
            for row in g['polyline_list']['values']:
                indices=row[2:];root=points[indices[0]];delta=fit(root)-root
                s=curves.splines.new('POLY');s.points.add(len(indices)-1);s.material_index=row[1]
                s.points.foreach_set('co',[c for i in indices for c in (*tuple(points[i]+delta),1)])
                for k,p in enumerate(s.points):p.radius=1-.8*(k/(len(indices)-1))**2
            ob=bpy.data.objects.new('G9_Pixie_Hair',curves);haircol.objects.link(ob)
            ob.parent=rig;ob.parent_type='BONE';ob.parent_bone='head';bpy.context.view_layer.update();ob.matrix_world=Matrix.Identity(4)
            report['parts']['G9_Pixie_Hair']={'strands':len(curves.splines),'source_points':len(points),'separate_object':True}

scene=bpy.context.scene;scene.render.resolution_x=850;scene.render.resolution_y=1000;scene.cycles.samples=32
cam=scene.camera;target=Vector((0,0,1.23));cam.location=(.45,-3,1.38);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=1.1
scene.render.filepath=str(ROOT/'previews/mitsuki_starter_outfit.png')
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.shading.type='MATERIAL'
            area.spaces.active.overlay.show_overlays=False
rig.show_in_front=False
bpy.ops.object.select_all(action='DESELECT');bpy.data.objects['G9_Base_Shirt'].select_set(True);bpy.context.view_layer.objects.active=bpy.data.objects['G9_Base_Shirt']
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mitsuki_starter_v02.blend'))
(OUT/'starter-wardrobe-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
bpy.ops.render.render(write_still=True)
print('WARDROBE_COMPLETE',json.dumps(report))
