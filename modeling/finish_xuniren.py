"""Build a Blender working version from the validated Maya geometry import.
Hair is an explicitly approximate reconstruction from original XGen guides.
"""
import bpy,random,math,json,bisect
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.kdtree import KDTree
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/xuniren'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'xuniren_import_v01.blend'))
rig=bpy.data.objects['XuNiren_Rig'];body=bpy.data.objects['Body_Model'];scene=bpy.context.scene
# Keep the working copy light; original full-resolution maps remain in SRC.
for im in bpy.data.images:
    if im.source=='FILE' and im.packed_file:
        w,h=im.size
        if max(w,h)>1024:
            ratio=1024/max(w,h);im.scale(max(1,int(w*ratio)),max(1,int(h*ratio)));im.pack()
print('WORKING_TEXTURES_DOWNSIZED',flush=True)
for name in ['Eye_Bai_Mat']:
    mat=bpy.data.materials.get(name)
    bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(1,1,1,1);bs.inputs['Transmission Weight'].default_value=1;bs.inputs['Roughness'].default_value=.025;bs.inputs['IOR'].default_value=1.38
for name in ['Hair_Mat']:
    mat=bpy.data.materials.get(name);bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.012,.006,.004,1);bs.inputs['Roughness'].default_value=.7;bs.inputs['Specular IOR Level'].default_value=.15
glasses=bpy.data.objects.get('Glasses_Model')
if glasses:glasses.hide_render=True;glasses.hide_set(True)
cap=bpy.data.objects['Head_HairModel'];cap.hide_render=False;cap.hide_set(False)
cap.data.materials.clear();cap.data.materials.append(bpy.data.materials['Hair_Mat'])
clearance=cap.modifiers.new('Scalp clearance','SHRINKWRAP');clearance.target=body;clearance.wrap_method='NEAREST_SURFACEPOINT';clearance.wrap_mode='OUTSIDE';clearance.offset=.003
source=bpy.data.objects['XGEN_GUIDES_ONLY'];source.hide_set(True)
guides=[[Vector(p.co[:3]) for p in s.points] for s in source.data.splines]
kd=KDTree(len(guides))
for i,g in enumerate(guides):kd.insert(g[0],i)
kd.balance()
def resample(g,n=14):
    lengths=[0]
    for a,b in zip(g,g[1:]):lengths.append(lengths[-1]+(b-a).length)
    result=[]
    for j in range(n):
        t=lengths[-1]*j/(n-1);k=min(len(g)-2,max(0,bisect.bisect_right(lengths,t)-1));f=(t-lengths[k])/max(1e-9,lengths[k+1]-lengths[k]);result.append(g[k].lerp(g[k+1],f)-g[0])
    return result
paths=[resample(g) for g in guides]
cap.data.calc_loop_triangles();triangles=list(cap.data.loop_triangles);cumulative=[];total=0
for tri in triangles:total+=tri.area;cumulative.append(total)
curve=bpy.data.curves.new('Guide-interpolated hair draft','CURVE');curve.dimensions='3D';curve.bevel_depth=.000065;curve.bevel_resolution=0;curve.resolution_u=1
hairmat=bpy.data.materials.get('Hair_Mat');curve.materials.append(hairmat)
rng=random.Random(2718)
for _ in range(5000):
    tri=triangles[min(len(triangles)-1,bisect.bisect_left(cumulative,rng.random()*total))];a,b,c=[cap.data.vertices[i].co for i in tri.vertices]
    u=math.sqrt(rng.random());v=rng.random();root=(1-u)*a+u*(1-v)*b+u*v*c+tri.normal*.0009
    nearest=kd.find_n(root,3)
    if nearest[0][2]>.037:continue
    weights=[1/max(.001,d)**3 for _,i,d in nearest];weight_sum=sum(weights);weights=[w/weight_sum for w in weights]
    spline=curve.splines.new('POLY');spline.points.add(13)
    for j,p in enumerate(spline.points):
        delta=sum((paths[i][j]*w for (_,i,d),w in zip(nearest,weights)),Vector((0,0,0)))
        pos=root+delta;p.co=(*pos,1);p.radius=1-.8*(j/13)**2
hair=bpy.data.objects.new('HAIR_DRAFT_from_XGen_guides',curve);bpy.data.collections['03_XGEN_GUIDES_NOT_FINAL_HAIR'].objects.link(hair)
hair['status']='Approximate guide interpolation; original XGen density, clumping and mask evaluation not reproduced.'
hair.parent=rig;hair.parent_type='BONE';hair.parent_bone='Head_M';bpy.context.view_layer.update();hair.matrix_world=Matrix.Identity(4)

# Test actual rest and small-pose skin deformation before adding an example action.
saved=[]
for ob in bpy.data.objects:
    for m in ob.modifiers:
        if m.type=='SUBSURF':saved.append((m,m.show_viewport));m.show_viewport=False
def positions(ob):
    bpy.context.view_layer.update();return [v.co.copy() for v in ob.evaluated_get(bpy.context.evaluated_depsgraph_get()).data.vertices]
rest=positions(body);err=max((v.co-r).length for v,r in zip(body.data.vertices,rest));assert err<1e-5,err
pb=rig.pose.bones['Head_M'];pb.rotation_mode='XYZ';pb.rotation_euler.z=.15
moved=positions(body);shift=[(a-b).length for a,b in zip(rest,moved)];assert max(shift)>.001
feet=[i for i,v in enumerate(rest) if v.z<.2];assert max(shift[i] for i in feet)<1e-5
pb.rotation_euler=(0,0,0)
for mod,visible in saved:mod.show_viewport=visible
for frame,angle in [(1,0),(24,.12),(48,-.12),(72,0)]:
    pb.rotation_euler.z=angle;pb.keyframe_insert(data_path='rotation_euler',frame=frame,group='Head')
if rig.animation_data and rig.animation_data.action:rig.animation_data.action.name='Head_turn_test_NOT_FULL_RIG'
scene.frame_end=72;scene.frame_set(1)
checks={'rest_error_m':err,'head_test_max_movement_m':max(shift),'head_test_feet_stationary':True,'reconstructed_hair_strands':len(curve.splines),'hair_status':'Approximate Blender reconstruction, not original XGen output','source_script_execution':False}
(OUT/'working-validation.json').write_text(json.dumps(checks,indent=2),encoding='utf8')
scene.cycles.samples=24;scene.render.resolution_x=900;scene.render.resolution_y=1100
cam=scene.camera;cam.location=(.3,-3.5,1.4);target=Vector((0,0,.99));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=2.03
scene.render.filepath=str(ROOT/'previews/xuniren_working_full.png')
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.type='MATERIAL'
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'xuniren_working_v01.blend'))
bpy.ops.render.render(write_still=True)
cam.location=(.13,-2.5,1.75);target=Vector((0,-.015,1.715));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=.44
scene.render.resolution_x=800;scene.render.resolution_y=900;scene.render.filepath=str(ROOT/'previews/xuniren_working_portrait.png');bpy.ops.render.render(write_still=True)
print('WORKING_VERSION_DONE',json.dumps(checks))
