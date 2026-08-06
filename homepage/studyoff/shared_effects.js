(function() {
  'use strict';

  /* ── Mouse Tracker ── */
  var mouse = { x: 0, y: 0 };
  document.addEventListener('mousemove', function(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }, { passive: true });

  /* ── Cursor Glow ── */
  (function() {
    var glow = document.getElementById('cursor-glow');
    if (!glow) return;
    var tx = 0, ty = 0, cx = 0, cy = 0;
    document.addEventListener('mousemove', function(e) {
      tx = e.clientX;
      ty = e.clientY;
    }, { passive: true });
    function update() {
      cx += (tx - cx) * 0.1;
      cy += (ty - cy) * 0.1;
      glow.style.left = cx + 'px';
      glow.style.top = cy + 'px';
      requestAnimationFrame(update);
    }
    update();
  })();

  /* ── Aurora Background ── */
  (function() {
    var canvas = document.getElementById('aurora-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var animId, time = 0;
    var colors = [
      [0, 100, 255, 0.05],
      [100, 50, 200, 0.03],
      [0, 200, 255, 0.04],
      [150, 50, 255, 0.03]
    ];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

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

  /* ── Mouse Trail ── */
  (function() {
    var canvas = document.getElementById('mouse-trail');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var points = [];
    var maxPoints = 20;
    var maxAge = 20;

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
      requestAnimationFrame(animate);
    }
    animate();
  })();

  /* ── Particles / Neurons Effect ── */
  (function() {
    var canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var particles = [];
    var numParticles = 50;
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
      requestAnimationFrame(animate);
    }
    animate();
  })();
})();
