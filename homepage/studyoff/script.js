(function() {
  'use strict';

  /* =============================================
     1. BOOT SCREEN
  ============================================= */
  (function bootScreen() {
    const screen = document.getElementById('boot-screen');
    const bar = document.getElementById('boot-bar');
    const percent = document.getElementById('boot-percent');
    if (!screen || !bar || !percent) return;
    let progress = 0;
    const interval = setInterval(function() {
      progress += Math.random() * 15 + 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(function() {
          screen.classList.add('fade-out');
          setTimeout(function() { screen.style.display = 'none'; }, 800);
        }, 500);
      }
      bar.style.width = Math.min(progress, 100) + '%';
      percent.textContent = Math.min(Math.round(progress), 100) + '%';
    }, 200);
  })();

  /* =============================================
     2. MOUSE TRACKER
  ============================================= */
  var mouse = { x: 0, y: 0, normalizedX: 0, normalizedY: 0 };
  var rafMouse = null;
  document.addEventListener('mousemove', function(e) {
    if (rafMouse) cancelAnimationFrame(rafMouse);
    rafMouse = requestAnimationFrame(function() {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.normalizedX = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.normalizedY = -(e.clientY / window.innerHeight) * 2 + 1;
    });
  }, { passive: true });

  /* =============================================
     3. CURSOR GLOW
  ============================================= */
  (function cursorGlow() {
    var glow = document.getElementById('cursor-glow');
    if (!glow) return;
    var targetX = 0, targetY = 0, currentX = 0, currentY = 0;
    document.addEventListener('mousemove', function(e) {
      targetX = e.clientX;
      targetY = e.clientY;
    }, { passive: true });
    function updateGlow() {
      currentX += (targetX - currentX) * 0.1;
      currentY += (targetY - currentY) * 0.1;
      glow.style.left = currentX + 'px';
      glow.style.top = currentY + 'px';
      requestAnimationFrame(updateGlow);
    }
    updateGlow();
  })();

  /* =============================================
     4. SCROLL PROGRESS
  ============================================= */
  (function scrollProgress() {
    var bar = document.getElementById('scroll-progress');
    if (!bar) return;
    window.addEventListener('scroll', function() {
      var scrollTop = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = docHeight > 0 ? scrollTop / docHeight : 0;
      bar.style.transform = 'scaleX(' + progress + ')';
    }, { passive: true });
  })();

  /* =============================================
     5. NAVBAR
  ============================================= */
  (function navbar() {
    var nav = document.getElementById('navbar');
    var toggle = document.getElementById('mobile-toggle');
    var menu = document.getElementById('mobile-menu');
    var menuIcon = document.getElementById('menu-icon');
    var closeIcon = document.getElementById('close-icon');

    window.addEventListener('scroll', function() {
      if (window.scrollY > 50) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    }, { passive: true });

    if (toggle && menu) {
      toggle.addEventListener('click', function() {
        var isOpen = menu.classList.toggle('open');
        menuIcon.classList.toggle('hidden', isOpen);
        closeIcon.classList.toggle('hidden', !isOpen);
      });

      menu.querySelectorAll('.mobile-link').forEach(function(link) {
        link.addEventListener('click', function() {
          menu.classList.remove('open');
          menuIcon.classList.remove('hidden');
          closeIcon.classList.add('hidden');
        });
      });
    }
  })();

  /* =============================================
     6. AURORA BACKGROUND
  ============================================= */
  (function aurora() {
    var canvas = document.getElementById('aurora-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var time = 0, animId;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    var colors = [
      [0, 100, 255, 0.05],
      [100, 50, 200, 0.03],
      [0, 200, 255, 0.04],
      [150, 50, 255, 0.03]
    ];

    function draw() {
      time += 0.002;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (var i = 0; i < colors.length; i++) {
        var c = colors[i];
        var grad = ctx.createLinearGradient(
          0, 0,
          canvas.width * (0.3 + Math.sin(time + i * 1.5) * 0.3),
          canvas.height * (0.3 + Math.cos(time + i * 1.5) * 0.3)
        );
        grad.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
        grad.addColorStop(0.5, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + c[3] + ')');
        grad.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      animId = requestAnimationFrame(draw);
    }
    draw();
  })();

  /* =============================================
     7. MOUSE TRAIL
  ============================================= */
  (function mouseTrail() {
    var canvas = document.getElementById('mouse-trail');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var points = [];
    var maxPoints = 20;
    var maxAge = 20;
    var animId;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    document.addEventListener('mousemove', function(e) {
      points.push({ x: e.clientX, y: e.clientY, age: 0 });
      if (points.length > maxPoints) points.shift();
    }, { passive: true });

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var valid = [];
      for (var i = 0; i < points.length; i++) {
        points[i].age++;
        if (points[i].age < maxAge) valid.push(points[i]);
      }
      points = valid;

      if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (var i = 1; i < points.length; i++) {
          var xc = (points[i].x + points[i - 1].x) / 2;
          var yc = (points[i].y + points[i - 1].y) / 2;
          ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
        }
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();

        for (var i = 0; i < points.length; i++) {
          var alpha = 1 - points[i].age / maxAge;
          var size = alpha * 4;
          ctx.beginPath();
          ctx.arc(points[i].x, points[i].y, size, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0, 212, 255, ' + (alpha * 0.3) + ')';
          ctx.fill();
        }
      }
      animId = requestAnimationFrame(animate);
    }
    animate();
  })();

  /* =============================================
     8. PARTICLES (Canvas-based)
  ============================================= */
  (function particles() {
    var canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var particles = [];
    var numParticles = 50;
    var animId;

    var colors = ['#00d4ff', '#8b5cf6', '#00f0ff'];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function Particle() {
      this.reset();
    }
    Particle.prototype.reset = function() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.vx = (Math.random() - 0.5) * 0.5;
      this.vy = (Math.random() - 0.5) * 0.5;
      this.size = Math.random() * 2 + 1;
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.opacity = Math.random() * 0.3 + 0.1;
      this.opacitySpeed = (Math.random() - 0.5) * 0.005;
    };
    Particle.prototype.update = function() {
      this.x += this.vx;
      this.y += this.vy;
      this.opacity += this.opacitySpeed;
      if (this.opacity > 0.4 || this.opacity < 0.05) this.opacitySpeed *= -1;
      if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
      if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
    };
    Particle.prototype.draw = function() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = this.opacity;
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    for (var i = 0; i < numParticles; i++) {
      particles.push(new Particle());
    }

    function drawLinks() {
      for (var i = 0; i < particles.length; i++) {
        for (var j = i + 1; j < particles.length; j++) {
          var dx = particles[i].x - particles[j].x;
          var dy = particles[i].y - particles[j].y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = '#00d4ff';
            ctx.globalAlpha = (1 - dist / 150) * 0.1;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      }
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (var i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
      }
      drawLinks();
      animId = requestAnimationFrame(animate);
    }
    animate();
  })();

  /* =============================================
     9. THREE.JS 3D SCENE (disabled)
     The heavy three.js neural/network visuals were removed per request.
     Keeping this as a no-op so pages that include Three.js won't error.
  ============================================= */
  (function threeScene() {
    if (!document.body || !document.body.classList.contains('homepage')) return;
    if (typeof THREE === 'undefined') return;
    var container = document.getElementById('three-container');
    if (!container) return;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 8);

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Lights
    var ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    var light1 = new THREE.PointLight(0x00d4ff, 0.8, 20);
    light1.position.set(10, 10, 10);
    scene.add(light1);
    var light2 = new THREE.PointLight(0x8b5cf6, 0.5, 20);
    light2.position.set(-10, -10, -10);
    scene.add(light2);

    // === Floating Objects ===
    var group = new THREE.Group();
    scene.add(group);

    function createTorusKnot(x, y, z, color, scale) {
      var geo = new THREE.TorusKnotGeometry(0.5, 0.2, 64, 8);
      var mat = new THREE.MeshStandardMaterial({
        color: color, roughness: 0.2, metalness: 0.8,
        transparent: true, opacity: 0.6, wireframe: true
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.scale.set(scale, scale, scale);
      mesh.userData = { speed: { x: 0.2, y: 0.3 } };
      group.add(mesh);
      return mesh;
    }

    function createIcosahedron(x, y, z, color, scale) {
      var geo = new THREE.IcosahedronGeometry(0.4, 0);
      var mat = new THREE.MeshStandardMaterial({
        color: color, roughness: 0.1, metalness: 0.3,
        transparent: true, opacity: 0.5
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.scale.set(scale, scale, scale);
      mesh.userData = { speed: { x: 0.15, y: 0.2 } };
      group.add(mesh);
      return mesh;
    }

    function createRing(x, y, z, color, scale) {
      var geo = new THREE.RingGeometry(0.6, 0.7, 64);
      var mat = new THREE.MeshBasicMaterial({
        color: color, transparent: true, opacity: 0.15, side: THREE.DoubleSide
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.scale.set(scale, scale, scale);
      mesh.userData = { speed: { z: 0.1, x: 0.05 } };
      group.add(mesh);
      return mesh;
    }

    function createCube(x, y, z, color, scale) {
      var geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
      var mat = new THREE.MeshStandardMaterial({
        color: color, roughness: 0.3, metalness: 0.6,
        transparent: true, opacity: 0.4, wireframe: true
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.scale.set(scale, scale, scale);
      mesh.userData = { speed: { x: 0.1, y: 0.15 } };
      group.add(mesh);
      return mesh;
    }

    var objects = [
      createTorusKnot(-2.5, 1.5, -2, '#00d4ff', 0.8),
      createIcosahedron(2.5, -1, -1.5, '#8b5cf6', 1),
      createRing(0, 2.5, -3, '#00f0ff', 1.2),
      createCube(-1.5, -2, -2.5, '#00d4ff', 0.9),
      createTorusKnot(3, 2, -4, '#8b5cf6', 0.6),
      createIcosahedron(-3, -1.5, -3.5, '#00f0ff', 0.7),
      createCube(1.5, 1, -4, '#00d4ff', 0.5),
      createRing(0, -2.5, -4, '#8b5cf6', 0.8),
    ];

    // === Neural Network ===
    var nodes = 60;
    var pos = [];
    var linePos = [];
    for (var i = 0; i < nodes; i++) {
      pos.push(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 6 - 2
      );
    }
    for (var i = 0; i < nodes; i++) {
      for (var j = i + 1; j < nodes; j++) {
        if (Math.random() < 0.06) {
          var i3 = i * 3, j3 = j * 3;
          linePos.push(pos[i3], pos[i3+1], pos[i3+2], pos[j3], pos[j3+1], pos[j3+2]);
        }
      }
    }

    var pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    var pointsMat = new THREE.PointsMaterial({
      size: 0.06, color: '#00d4ff', transparent: true, opacity: 0.6, sizeAttenuation: true
    });
    var pointsMesh = new THREE.Points(pointsGeo, pointsMat);
    scene.add(pointsMesh);

    var linesGeo = new THREE.BufferGeometry();
    linesGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
    var linesMat = new THREE.LineBasicMaterial({ color: '#00d4ff', transparent: true, opacity: 0.08 });
    var linesMesh = new THREE.LineSegments(linesGeo, linesMat);
    scene.add(linesMesh);

    // === Resize Handler ===
    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    // === Animation Loop ===
    var clock = new THREE.Clock();
    function animate() {
      var delta = clock.getDelta();
      var elapsed = Date.now() * 0.0001;

      // Rotate floating objects
      for (var i = 0; i < objects.length; i++) {
        var obj = objects[i];
        var speed = obj.userData.speed;
        if (speed.x) obj.rotation.x += delta * speed.x;
        if (speed.y) obj.rotation.y += delta * speed.y;
        if (speed.z) obj.rotation.z += delta * speed.z;
      }

      // Group follow mouse
      group.rotation.y += (mouse.normalizedX * 0.5 - group.rotation.y) * 0.02;
      group.rotation.x += (-mouse.normalizedY * 0.5 - group.rotation.x) * 0.02;

      // Neural network rotation
      pointsMesh.rotation.y += delta * 0.05;
      pointsMesh.rotation.x = Math.sin(elapsed) * 0.1;
      linesMesh.rotation.y += delta * 0.05;
      linesMesh.rotation.x = Math.sin(elapsed) * 0.1;

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    animate();
  })();

  /* =============================================
     10. SCROLL REVEAL (IntersectionObserver)
  ============================================= */
  (function scrollReveal() {
    var reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '-50px' });

    reveals.forEach(function(el) { observer.observe(el); });
  })();

  /* =============================================
     11. WORKFLOW STEP REVEAL
  ============================================= */
  (function workflowReveal() {
    var steps = document.querySelectorAll('.workflow-step');
    if (!steps.length) return;

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '-100px' });

    steps.forEach(function(el) { observer.observe(el); });
  })();

  /* =============================================
     12. SECTION DIVIDER ANIMATION
  ============================================= */
  (function sectionDividers() {
    var dividers = document.querySelectorAll('.section-divider');
    dividers.forEach(function(divider) {
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            // Re-trigger animations by re-adding pseudo-elements
            // (They already auto-animate in CSS on load)
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
      observer.observe(divider);
    });
  })();

  /* =============================================
     13. GLASS CARD TILT EFFECT
  ============================================= */
  (function glassCardTilt() {
    var cards = document.querySelectorAll('.glass-card');
    cards.forEach(function(card) {
      card.addEventListener('mousemove', function(e) {
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var centerX = rect.width / 2;
        var centerY = rect.height / 2;
        var rotateX = (y - centerY) / 20;
        var rotateY = (x - centerX) / 20;
        card.style.transform = 'perspective(1000px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg)';
        card.style.transition = 'none';
      });
      card.addEventListener('mouseleave', function() {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
        card.style.transition = 'transform 0.3s ease';
      });
    });
  })();

  /* =============================================
     14. MAGNETIC BUTTONS
  ============================================= */
  (function magneticButtons() {
    var magnets = document.querySelectorAll('.magnetic');
    magnets.forEach(function(btn) {
      btn.addEventListener('mousemove', function(e) {
        var rect = btn.getBoundingClientRect();
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;
        var strength = parseFloat(btn.getAttribute('data-strength')) || 12;
        btn.style.transform = 'translate(' + (x / strength) + 'px, ' + (y / strength) + 'px)';
      });
      btn.addEventListener('mouseleave', function() {
        btn.style.transform = 'translate(0, 0)';
      });
    });
  })();

  /* =============================================
     15. FOOTER BACK TO TOP
  ============================================= */
  (function backToTop() {
    var btn = document.getElementById('back-to-top');
    if (!btn) return;
    btn.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  })();

  /* =============================================
     17. NEWS LETTER FORM
  ============================================= */
  (function newsletterForm() {
    var form = document.getElementById('newsletter-form');
    if (!form) return;
    form.addEventListener('submit', function(e) {
      e.preventDefault();
    });
  })();

})();
