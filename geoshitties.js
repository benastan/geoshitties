Geoshitties = {};

$('a').on('click', function() {
  var trigger = this.getAttribute('data-trigger');
  if ('string' === typeof trigger) {
    $(document).triggerHandler(trigger);
  }
});

var
  frameDocument = window.frames[0].window.document
, $$ = function(selector) { return $(selector, frameDocument); }
, currentRepo
, currentFile
, selectProjectModal = $('#select-project-modal')
;

function createRepo() {
  var reponame = prompt('what should the repo be named?');
  repo = client.getRepo('geoshitties', 'geoshitties');
  repo.fork(function(err) {
    currentRepo = client.getRepo(username, 'geoshitties');
    function testFork(cb) {
      currentRepo.contents('gh-pages', 'index.html', function(err, res) {
        err ? testFork(cb) : cb(res);
      });
    };
    currentRepo.edit({ name: reponame }, function() {
      testFork(function() { showRepo(); });
    });
  });
}

$(document).on('geoshitties:repo:new', function() {
  $('#site').toggleClass('hide', true);
  showModal('new-project-modal');
});

$('#new-project-form').on('submit', function() {
  $(document).triggerHandler('geoshitties:repo:create', this.projectname.value);
  return false;
});

$(document).on('geoshitties:repo:create', function(e, reponame) {
  Geoshitties.user.createRepo(reponame, { auto_init: true }, function(err, repo) {
    currentRepo = Geoshitties.client.getRepo(Geoshitties.username, reponame);
    currentRepo.getSha('master', '', function(err, sha) {
      var ref = {
        ref: 'refs/heads/gh-pages',
        sha: sha
      };
      currentRepo.createRef(ref, function(err, rsp) {
        currentRepo.write('gh-pages', 'index.html', '<h1>Hello world!</h1>', 'Initial project commit!!', function() {
          $(document).triggerHandler('geoshitties:repo:set');
        });
      });
    });
  });
});

$(document).on('geoshitties:repo:select', function() { showModal('select-project-modal'); });

$.fn.renderItems = function(options) {
  this.each(function() {
    var $this = $(this);
    if (!options.name) options.name = '';
    if (options.append !== true) $this.children().remove();
    options.items.forEach(function(item) {
      var data = options.format(item), html;
      html = '<li> \
  <input type="radio" name="'+options.name+'" id="'+data.id+'" class="select-item-input" value="'+data.value+'" /> \
  <label for="'+data.id+'" class="select-item-label">'+data.text+'</label> \
</li>';
      $this.append(html);
    });
  });
};

$(document).on('geoshitties:user:set', function(e, username, password) {
  Geoshitties.client = new Github({
    username: username,
    password: password,
    auth: 'basic'
  });
  Geoshitties.user = Geoshitties.client.getUser();
  Geoshitties.user.repos(function(err, repos) {
    Geoshitties.repos = repos;
    selectProjectModal.find('.select-item-list').renderItems({
      items: Geoshitties.repos,
      name: 'repo',
      format: function(repo) {
        return {
          id: 'repo_'+repo.full_name.replace('/','_'),
          text: repo.full_name,
          value: repo.full_name
        };
      }
    });
    $('#new-project').toggleClass('hide', Geoshitties.username === 'geoshitties');
    $(document).trigger('geoshitties:repo:select');
  });
});

$(document).on('geoshitties:repo:set', function(e, repo) {
  if ('string' === typeof repo) {
    var username = repo.split('/')[0],
        reponame = repo.split('/')[1];
    currentRepo = Geoshitties.client.getRepo(username, reponame);
  }
  currentRepo.getTree('gh-pages', function(err, tree) {
    if (!err) renderTree(tree);
    $(document).trigger('geoshitties:file:select');
  });
});

function renderTree(tree) {
  $('#select-file-modal').find('.select-item-list').renderItems({
    items: tree,
    name: 'file',
    format: function(file) {
      return {
        id: file.path.replace(/\.|\//g, '_'),
        text: file.path,
        value: file.path
      };
    }
  });
};

$(document).on('geoshitties:file:select', function() { showModal('select-file-modal'); });

$('#select-file-form').on('submit', function() {
  $(document).trigger('geoshitties:file:set', $(this.file).filter(':checked').val());
  return false;
});

$(document).on('geoshitties:file:set', function(e, filepath) {
  currentFile = filepath;
  var html, style;
  currentRepo.read('gh-pages', filepath, function(err, data, sha) {
    var re = /(?:<body>)([\w|\W]*)(?=<\/body>)/;
    html = re.test(data) ? data.match(re)[1] : data;
    showFile();
  });
  currentRepo.read('gh-pages', 'style.css', function(err, data, sha) {
    style = $$('<style id="siteStyle">').html(data);
    showFile();
  });
  function showFile() {
    if ('string' === typeof html && 'undefined' !== typeof style) {
      $$('head').html('').append(style);
      $$('body').html(html);
    }
    hideModals();
    $(document).triggerHandler('geoshitties:site:show');
  }
});

$(document).on('geoshitties:site:show', function() { $('#site').toggleClass('hide', false); });
$(document).on('geoshitties:site:hide', function() { $('#site').toggleClass('hide', true); });

$(document).on('geoshitties:file:save', function(e) {
  var html = '<html><head><link href="style.css" rel="stylesheet" type="text/css" /></head><body>'+$$('body').clone().html()+'</body></html>';
  $(document).on('geoshitties:stylesheet:saved', function() {
    currentRepo.write('gh-pages', currentFile, html, 'Autopush from geoshitties', function(err) { });
    $(document).off('geoshitties:stylesheet:saved');
  });
  $(document).triggerHandler('geoshitties:stylesheet:save');
});

$(document).on('geoshitties:stylesheet:save', function() {
  css = '';
  Array.prototype.slice.apply(frameDocument.styleSheets).forEach(function(sheet) {
    Array.prototype.slice.apply(sheet.cssRules).forEach(function(rule) {
      css += rule.cssText + "\n";
    });
  });
  currentRepo.write('gh-pages', 'style.css', css, 'Updating stylesheet', function( ){
    $(document).triggerHandler('geoshitties:stylesheet:saved');
  });
});

$('.closeFile').on('click', function() {
  currentFile = false;
  $$('body').html('');
  $$('head').html('');
  showTree();
  return false;
});

$modals = $('#modals');

$modals.on('click', function(){ hideModals(); });
$modals.find('> .modal').on('click', function(e) {
  e.stopPropagation();
});

function showModal(id) {
  hideModals();
  $modals.toggleClass('hide', false);
  $('#'+id).toggleClass('hide', false);
}

function hideModals() {
  $modals.find('> .modal').andSelf().toggleClass('hide', true);
}

$(document).on('geoshitties:user:signin', function() {
  showModal('sign-in-modal');
});

$('#sign-in-form').on('submit', function() {
  Geoshitties.username = this.username.value;
  $(document).trigger('geoshitties:user:set', [this.username.value, this.password.value]);
  return false;
});

$('#select-project-form').on('submit', function() {
  $(document).trigger('geoshitties:repo:set', $(this.repo).filter(':checked').val());
  hideModals();
  return false;
});

$(document).trigger('geoshitties:user:signin');
