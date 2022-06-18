let materialThickness = 3.8
let edgeDist = 3 //hier in zwei werte aufteilen
let airDist = 5 //lücke zwischen den platten
let boltWidth = 6 //zapfenlänge praktisch
let boltHeight = materialThickness //zapfentiefe. sollte in meinem fall holzdicke sein
let debug = false
let fitFactor = -0.3
let base = 400
let edgeLengths = []
let nrCuts = 15 //_.random(7,10)
let lookOffset = 50; //pecent
let cutDepth = 0.10
console.log(nrCuts)

paper.install(window);

window.onload = function() {
    paper.setup('myCanvas');
    if(!debug){
        view.scaling = 96 / 25.4
    }
    const frame = document.querySelector('.frame').getBoundingClientRect();

    let testi = new Path.Rectangle([50,50],[4,6])
    testi.fillColor = 'blue'

    // setup scene and renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera( 75, frame.width / frame.height, 0.1, 2000 );
    const renderer = new THREE.WebGLRenderer({ alpha: true });
    const controls = new THREE.OrbitControls(camera, renderer.domElement);

    renderer.setSize(frame.width, frame.height);
    document.querySelector('.frame').appendChild(renderer.domElement);
    camera.position.z = 2;


    const RADIUS = 0.75


    // create lighting
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.75);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);

    directionalLight.position.x = 15;
    directionalLight.position.z = 15;

    scene.add(directionalLight);
    scene.add(ambientLight);


    // create and position shape objects
    const primaryCubeGeometry = new THREE.BoxGeometry(base,base,base);
    const primaryMaterial = new THREE.MeshPhongMaterial({ color: 0x6666FF });
    const primaryCube = new THREE.Mesh(primaryCubeGeometry, primaryMaterial);

    const secondaryCubeGeometry = new THREE.BoxGeometry(base*2, base*2, base/2);
    const secondartMaterial = new THREE.MeshPhongMaterial({ color: 0xFFAFAF });
    const secondaryCube = new THREE.Mesh(secondaryCubeGeometry, secondartMaterial);

    const placeholderCubeGeometry = new THREE.BoxBufferGeometry(base*2, base*2, base/2, 1, 1, 1);
    const placeholderEdges = new THREE.EdgesGeometry(placeholderCubeGeometry);
    const placeholderCube = new THREE.LineSegments(placeholderEdges, new THREE.LineBasicMaterial({ color: 0xFFAFAF }));


    secondaryCube.position.copy(getRandomPointOnSphere(base*0.75));
    placeholderCube.position.copy(secondaryCube.position);
    secondaryCube.lookAt(primaryCube.position);
    placeholderCube.lookAt(primaryCube.position);

    // use csg to perform subtraction/boolean operation
    const csgPrimaryCube = new ThreeBSP(primaryCube);


    let csgSecondaryCube = new ThreeBSP(secondaryCube);
    let subtraction = csgPrimaryCube.subtract(csgSecondaryCube);

    for(let i = 0; i<nrCuts; i++){
        let p = getFarPoint(subtraction.tree.allPolygons())
        let dist = Math.random()*cutDepth
        let newP = new THREE.Vector3(p.x*(1-dist), p.y*(1-dist), p.z*(1-dist))
        //secondaryCube.position.copy(getRandomPointOnSphere(base*0.75));
        secondaryCube.position.copy(newP);
        
        secondaryCube.lookAt(primaryCube.position.x + _.random(-base/lookOffset, base/lookOffset), primaryCube.position.y + _.random(-base/lookOffset, base/lookOffset), primaryCube.position.z + _.random(-base/lookOffset, base/lookOffset));
        
        csgSecondaryCube = new ThreeBSP(secondaryCube);
        subtraction = subtraction.subtract(csgSecondaryCube);
    }

    console.log(subtraction)
    let polys = subtraction.tree.allPolygons()
    //console.log(polys)
    //console.log(hasSimilarNormal(polys[0], polys, 0.01))
    let newpolys = fusePolygons(polys)
    
    for(let [idx,pol] of newpolys.entries()){
        //console.log(pol)
        
        let allInters = []
        //find out which polygons have common edges
        for(let [idx2,pol2] of newpolys.entries()){
            if(idx != idx2){
            
                let interIdx = findSameVertex(pol, pol2)
                let inters = []
                for(let ii of interIdx){
                    inters.push(pol.vertices[ii[0]])
                    
                }
                if(inters.length >= 2){
                    let v1 = new THREE.Vector3(pol.normal.x, pol.normal.y, pol.normal.z)
                    let v2 = new THREE.Vector3(pol2.normal.x, pol2.normal.y, pol2.normal.z)
                    
                    allInters.push({a:idx, targetID:idx2, inters:inters, angle:v1.angleTo(v2) })
                    
                }else if(inters.length == 1 ){
                    console.log("UNNORMAL INTERS AMOUNT", inters.length, inters)
                }
            }
        }
        let info = polygonTo2D(pol, allInters)
        let polyCoords = info.local_coords
        //console.log(info.edge_coords)
        drawElement(polyCoords, info.edge_coords, idx, [idx*120+60,200])
        //draw brücke hier
        let bridges = drawBrides(allInters)
        bridges.bounds.topCenter = [idx*120+60,250]
    }
    
    


    const subtractionMesh = subtraction.toMesh();

    var geo = new THREE.EdgesGeometry( subtractionMesh.geometry, 0 ); // or WireframeGeometry
    var mat = new THREE.LineBasicMaterial( { color: 0xffffff } );
    var wireframe = new THREE.LineSegments( geo, mat );
    subtractionMesh.add( wireframe );

    subtractionMesh.material = primaryMaterial;


    // add shapes to scene
    scene.add(subtractionMesh);
    scene.add(placeholderCube);

    
    var bbox = new THREE.Box3().setFromObject(subtractionMesh);
    let finalSize = new THREE.Vector3()
    bbox.getSize(finalSize)
    console.log(finalSize)
    
    downloadSVG()
    console.log(edgeLengths)
    
    view.scaling = debug ? 5 : 1
    
    
function getFarPoint(polygons){
    let p
    let max = 0
    for(let poly of polygons){
        for(let v of poly.vertices){
            let dist = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z)
            if(dist > max){
                p = v
                max = dist
            }
        }
    }
    console.log(max)
    return p
}    
    
//ToDo fuse polygons and keep normal for angle
function downloadSVG(){
    var svg = project.exportSVG({ asString: true });
    var svgBlob = new Blob([svg], {type:"image/svg+xml;charset=utf-8"});
    var svgUrl = URL.createObjectURL(svgBlob);
    var downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = "test.svg";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}
    
function fusePolygons(polys){
    let fusedPolys = []
    
    while(polys.length > 0){
        let similarIdx = hasSimilarNormal(polys[0], polys)
        let similar = []
        for(let idx = 0; idx<similarIdx.length; idx++){
            if(similarIdx[idx]==1){
                similar.push(polys[idx])
            }
        }
        
        _.remove(polys, function(n, idx) {
            return similarIdx[idx]==1
        });
        
        if(similar.length > 1){
            fusedPolys.push(fuse(similar))
        }else{
            fusedPolys.push(similar[0])
        }
    }
    return fusedPolys
}

function fuse(args){
    //console.log("args:", args)
    let fused = args[0]
    
    for(let i = 1; i<args.length; i++){
        let newVertices = []
        let same = findSameVertex(fused, args[i])
        //console.log(same)
        newVertices = fused.vertices.slice(0, same[0][0])
        newVertices = newVertices.concat( args[i].vertices.slice(same[0][1]) )
        newVertices = newVertices.concat( args[i].vertices.slice(0, same[0][1]) )
        newVertices = newVertices.concat( fused.vertices.slice(same[1][0]+1) )
        //console.log(newVertices.length)
        fused = {
            vertices: newVertices,
            normal: fused.normal,
            w: fused.w
        }
    }
    return fused
}

// array mit allen [obj1 idx, obj2 idx] treffern
function findSameVertex(obj1, obj2){
    let ep = 0.000001
    let same = []
    for(let i=0; i<obj1.vertices.length; i++){
        for(let j=0; j<obj2.vertices.length; j++){
            if(Math.abs(obj1.vertices[i].x - obj2.vertices[j].x) < ep && Math.abs(obj1.vertices[i].y - obj2.vertices[j].y) < ep && Math.abs(obj1.vertices[i].z - obj2.vertices[j].z) < ep  ){
                same.push( [i,j] )
                //console.log(obj1.vertices[i].x - obj2.vertices[j].x, obj1.vertices[i].y - obj2.vertices[j].y, obj1.vertices[i].z - obj2.vertices[j].z)
            }
        }
    }
    return same
}
    
function hasSimilarNormal(poly3D, poly3Darr, epsylon=0.00001){
    similar = []
    let polyNorm = new THREE.Vector3(poly3D.normal.x, poly3D.normal.y, poly3D.normal.z)
    for(let p of poly3Darr){
        let pNorm = new THREE.Vector3(p.normal.x, p.normal.y, p.normal.z)
        if(pNorm.angleTo(polyNorm) < epsylon){
            similar.push(1)
        }else{
            similar.push(0)
        }
    }
    return similar
}

function drawElement(polyCoords, edges, id, pos=paper.view.bounds.center){
    let paperPoly = new Path(polyCoords)
    if(debug){
        paperPoly.fillColor = getColorFromID(id)
        paperPoly.selected = true
    }
    simplifyPolygon(paperPoly)
    
    let polyGroup = new Group([paperPoly])
    
    for(let edge of edges){
        if(edge.x3){
          
            
            
            if(debug){
                let r = new Path.Rectangle([300,300], [20,20])
                r.fillColor = getColorFromID(edge.targetID)
                r.strokeColor = getColorFromID(id)
                r.strokeWidth = 3
            }
            console.log("EDGE FAULTY")
            
        }
        let line = new Path.Line([edge.x1, edge.y1], [edge.x2, edge.y2])
        if(edge.x3){
            line.add([edge.x3, edge.y3])
        }
        //line.scale(50)
        
        
        line.strokeWidth = debug ? 5 : 0.2
        line.strokeColor = debug ? getColorFromID(edge.targetID) : 'black'
        line.targetID = edge.targetID
        if(!edgeLengths[id]){
            edgeLengths[id] = []
        }
        edgeLengths[id][edge.targetID] = line.length
        if(!edgeLengths[edge.targetID]){
            edgeLengths[edge.targetID] = []
        }
        if(edgeLengths[edge.targetID][id]){
            let diff = edgeLengths[edge.targetID][id]-edgeLengths[id][edge.targetID]
            
            if(Math.abs(diff)>=1){
                console.log("edge DIFF bigger than 0.01", id, edge.targetID, diff)
            }
        }
        
        
        //simplifyPolygon(line, true)
        polyGroup.addChild(line)
        
    }
    
    polyGroup.position = pos
    
    drawHole(polyGroup, id)
    
    let innerPath = PaperOffset.offset(paperPoly, -(6+boltWidth+airDist), { join: 'round' })
    innerPath.strokeColor = 'purple'
    innerPath.strokeWidth = 0.2
    
    let outerPath = PaperOffset.offset(paperPoly, -(airDist), { join: 'round' })
    outerPath.strokeColor = 'black'
    outerPath.strokeWidth = 0.2
    
    //let nr = drawNumber(id, new Rectangle(pos, [boltWidth/4, boltHeight/2]))
    //polyGroup.addChild(nr)
    polyGroup.addChild(innerPath)
    polyGroup.addChild(outerPath)
    
}

function getColorFromID(id){
    return {hue: id*30, saturation: 1, lightness:0.5}
}

function drawHole(polygroup, id){
    let holes = new Group()
    for(let [idx, edge] of polygroup.children.entries()){
        if(idx !=0){
            
           
            
    
            let p1 = edge.getPointAt((edge.length-materialThickness-fitFactor)/2)
            let p2 = edge.getPointAt((edge.length+materialThickness+fitFactor)/2)
            if(p1 && p2){
                let n = edge.getNormalAt(edge.length/2)
                let i = -1
                if(polygroup.children[0].contains(p1.add(n.multiply(edgeDist)))){
                    i = 1
                }
            
            
                let hole = new Path()
                hole.add(p1.add(n.multiply(i*(edgeDist+airDist))))
                hole.add(p2.add(n.multiply(i*(edgeDist+airDist))))
                hole.add(p2.add(n.multiply(i*(edgeDist+boltWidth+fitFactor+airDist))))
                hole.add(p1.add(n.multiply(i*(edgeDist+boltWidth+fitFactor+airDist))))
                hole.strokeColor = 'blue'
                hole.strokeWidth = 0.2
                hole.closed = true
                
                let nr = drawNumber(edge.targetID, new Rectangle([0,0], [boltWidth/4, boltHeight/2]))
                nr.position = p1.add(n.multiply(i*(edgeDist/2+airDist)))
                nr.rotate(n.angle+(90*i))
                
                let ownNr = drawNumber(id, new Rectangle([0,0], [boltWidth/4, boltHeight/2]))
                ownNr.position = p1.add(n.multiply(i*(boltWidth+fitFactor+edgeDist*1.5+airDist)))
                ownNr.rotate(n.angle+(90*i))
                
                holes.addChild(hole)
                holes.addChild(nr)
                holes.addChild(ownNr)
            }else{
                console.log("ERROR creating holes - edge might be too small")
            }
        }
    }
    polygroup.removeChildren()
    polygroup.addChild(holes)
}

function drawBrides(allInters){

    let restSize = 6
    let group = new Group()
    
     for(let [idx,inter] of allInters.entries()){
         if(inter.a < inter.targetID){ 
           
            let alpha = Math.PI-inter.angle
            let outerAngle = 90-((alpha*180/Math.PI)/2)
            let y = Math.sin(alpha/2)*(boltHeight+boltWidth+edgeDist+airDist)-(2*boltHeight*Math.sin(45*Math.PI/180))
            
            
            let base = new Path.Rectangle([100,350 + 15*idx], [y*2, boltHeight+2])
            let nr1 = drawNumber(inter.a, new Rectangle([0,0],[boltWidth/4, boltHeight/2]))
            nr1.bounds.rightCenter = base.position.subtract([2,0])
            
            let nr2 = drawNumber(inter.targetID, new Rectangle([0,0],[boltWidth/4, boltHeight/2]))
            nr2.bounds.leftCenter = base.position
            

            let arm = new Path.Rectangle([0,0],[boltWidth, boltHeight*2])
            let arm2 = arm.clone()
            arm.bounds.bottomLeft = base.bounds.bottomLeft
            arm2.bounds.bottomRight = base.bounds.bottomRight
            
            
            let brd = new Path.Rectangle([0,0],[boltWidth+restSize, boltHeight])
            brd.bounds.bottomCenter = arm.bounds.bottomCenter
            let brd2 = brd.clone()
            brd2.bounds.bottomCenter = arm2.bounds.bottomCenter
            
            brd2.rotate(outerAngle, arm2.bounds.bottomRight)
            brd.rotate(-outerAngle, arm.bounds.bottomLeft)
            arm2.rotate(outerAngle, arm2.bounds.bottomRight)
            arm.rotate(-outerAngle, arm.bounds.bottomLeft)
            
            let baseFix = new Path()
            baseFix.add(brd.segments[0].point)
            baseFix.add(brd2.segments[3].point)
            baseFix.add(brd2.segments[1].point)
            baseFix.add(brd.segments[2].point)
            base.remove()
            
            let final = uniteAll([baseFix, arm, arm2, brd, brd2])
            final.fillColor = debug ? getColorFromID(inter.targetID) : null
            final.strokeColor = debug ? null : 'green'
            final.strokeWidth = 0.2
            
            let singleBridge = new Group([final, nr1, nr2])
            group.addChild(singleBridge)
         }
    }
    return group
}

function uniteAll(list){
    let base = list[0]
    for(let i = 1; i<list.length; i++){
        let tmp = base.unite(list[i])
        list[i].remove()
        base.remove()
        base = tmp
    }
    return base
}

function polyIncludesPoint(polyCoords, point){
    
    for(let co of polyCoords){
   
    }
}

function simplifyPolygon(paperPoly){
    
    paperPoly.addSegment(paperPoly.firstSegment)
    
    for(let i = 0; i<paperPoly.curves.length-1; ){
        let n1 = paperPoly.curves[i].getNormalAt(paperPoly.curves[i].length/2)
        let n2 = paperPoly.curves[i+1].getNormalAt(paperPoly.curves[i+1].length/2)
        if(n1.getAngle(n2) < 0.001){
            paperPoly.removeSegment(i+1)
        }else{
            i++
        }
    }
    
    paperPoly.removeSegment(paperPoly.segments.length-1)
    paperPoly.closed = true
    
}


function polygonTo2D(poly, polyinters){
    //loc0 = p0                       # local origin
    //locx = p1 - loc0                # local X axis
    //normal = cross(locx, p2 - loc0) # vector orthogonal to polygon plane
    //locy = cross(normal, locx)      # local Y axis
    //console.log(poly)
    let loc0 = poly.vertices[0].clone()
    let locx = poly.vertices[1].clone().subtract(loc0)
    let normal = poly.normal.clone()
    //let normal = locx.clone().cross(poly.vertices[2].clone().subtract(loc0))
    //let normal = poly.vertices[2].clone().subtract(loc0).normal
    let locy = normal.clone().cross(locx)
    
    // locx /= locx.length()
    // locy /= locy.length()
    locx.normalize()
    locy.normalize()
    
    
    //local_coords = [(dot(p - loc0, locx),  # local X coordinate
    //             dot(p - loc0, locy))  # local Y coordinate
    //            for p in points]
    let local_coords = []
    for(let p of poly.vertices){
        let newP = {
            x: p.clone().subtract(loc0).dot(locx),
            y: p.clone().subtract(loc0).dot(locy)
        }
        local_coords.push(newP)
    }
    
    let edge_coords = []
    for(let inters of polyinters){
        let newEdge = {
            x1: inters.inters[0].clone().subtract(loc0).dot(locx),
            y1: inters.inters[0].clone().subtract(loc0).dot(locy),
            x2: inters.inters[1].clone().subtract(loc0).dot(locx),
            y2: inters.inters[1].clone().subtract(loc0).dot(locy),
            targetID: inters.targetID
        }
        if(inters.inters[2]){
            newEdge['x3'] = inters.inters[2].clone().subtract(loc0).dot(locx)
            newEdge['y3'] = inters.inters[2].clone().subtract(loc0).dot(locy)
        }
        edge_coords.push(newEdge)
    }
    
    return {local_coords, edge_coords}
}


function drawSingleNumber(n, bounds){
    let number = new Path({strokeColor:'red', strokeWidth:0.2})
 
    switch(n){
        case 0:
            number.add(bounds.topLeft)
            number.add(bounds.topRight)
            number.add(bounds.bottomRight)
            number.add(bounds.bottomLeft)
            number.add(bounds.topLeft)
            break
        case 1:
            number.add(bounds.topCenter)
            number.add(bounds.bottomCenter)
            break
        case 2:
            number.add(bounds.topLeft)
            number.add(bounds.topRight)
            number.add(bounds.rightCenter)
            number.add(bounds.leftCenter)
            number.add(bounds.bottomLeft)
            number.add(bounds.bottomRight)
            break
        case 3:
            number.add(bounds.topLeft)
            number.add(bounds.topRight)
            number.add(bounds.rightCenter)
            number.add(bounds.leftCenter)
            number.add(bounds.rightCenter)
            number.add(bounds.bottomRight)
            number.add(bounds.bottomLeft)
            break
        case 4:
            number.add(bounds.topLeft)
            number.add(bounds.leftCenter)
            number.add(bounds.rightCenter)
            number.add(bounds.topRight)
            number.add(bounds.bottomRight)
            break
        case 5:
            number.add(bounds.topRight)
            number.add(bounds.topLeft)
            number.add(bounds.leftCenter)
            number.add(bounds.rightCenter)
            number.add(bounds.bottomRight)
            number.add(bounds.bottomLeft)
            break
        case 6:
            number.add(bounds.topLeft)
            number.add(bounds.bottomLeft)
            number.add(bounds.bottomRight)
            number.add(bounds.rightCenter)
            number.add(bounds.leftCenter)
            break
        case 7:
            number.add(bounds.topLeft)
            number.add(bounds.topRight)
            number.add(bounds.bottomRight)
            break
        case 8:
            number.add(bounds.rightCenter)
            number.add(bounds.topRight)
            number.add(bounds.topLeft)
            number.add(bounds.bottomLeft)
            number.add(bounds.bottomRight)
            number.add(bounds.rightCenter)
            number.add(bounds.leftCenter)
            break
        case 9:
            number.add(bounds.rightCenter)
            number.add(bounds.leftCenter)
            number.add(bounds.topLeft)
            number.add(bounds.topRight)
            number.add(bounds.bottomRight)
            number.add(bounds.bottomLeft)
            break
    }
    return number
}

function drawNumber(n, bounds){
    if(n <= 9){
        return drawSingleNumber(n, bounds)
    }
    let group = new Group()
    group.position = bounds.position
    n = n.toString()
    console.log("drawing ", n)
    for(let l of n){
        let nr = drawSingleNumber(parseInt(l),bounds)
        nr.bounds.leftCenter = group.bounds.rightCenter.add([1,0])
        group.addChild(nr)
    }
    return group
}

function calculateFaceNormals(geo){
    let faceNormals = []
    let vertices = geo.vertices
    for(let face of geo.faces){
        let triangle = new THREE.Triangle(vertices[face.a], vertices[face.b], vertices[face.c])
        let nor = new THREE.Vector3()
        triangle.getNormal(nor)
        faceNormals.push(nor)
    }
    return faceNormals
}

// animate
const animate = () => {
  requestAnimationFrame( animate );
  renderer.render( scene, camera );
};

animate();

function getRandomPointOnSphere(radius){
    let phi = Math.random()*180-90 * Math.PI/180 ;
    let theta = Math.random()*360-180 * Math.PI/180 ;
    return sphere2Cartesian(phi, theta, radius);
}

function sphere2Cartesian(phi, theta, radius){
    let x = Math.sin(phi) * Math.cos(theta) * radius;
    let y = Math.sin(theta) * radius;
    let z = Math.cos(phi) * Math.cos(theta) * radius;
    return new THREE.Vector3(x, y, z)
}

function onWindowResize() {
  const frame = document.querySelector('.frame').getBoundingClientRect();
  
  camera.aspect = frame.width / frame.height;
  camera.updateProjectionMatrix();

  renderer.setSize( frame.width, frame.height);
}

window.addEventListener('resize', onWindowResize, false);

}
