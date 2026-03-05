class Verb {
  constructor(data) {
    Object.assign(this, data);
  }
}

class QuizManager {
  constructor(verbs) {
    this.verbs = verbs.map(v => new Verb(v));
    this.mode = 'easy';
    this.currentVerbs = [];
    this.placedAnswers = {}; // { [dropZoneId]: { type, text } }
    this.choices = [];
  }

  setMode(mode) {
    this.mode = mode;
  }

  getRandomVerbs(count) {
    const shuffled = [...this.verbs].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  loadNewQuiz() {
    const count = this.mode === 'easy' ? 1 : 5;
    this.currentVerbs = this.getRandomVerbs(count);
    this.placedAnswers = {};
    this.renderQuiz();
    this.renderChoices();
    this.showSubmitBtn();
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.onclick = () => this.checkAnswers();
    }
  }

  renderQuiz() {
    const quizEl = document.getElementById('quiz');
    quizEl.innerHTML = '';
    this.currentVerbs.forEach((verb, index) => {
      const card = document.createElement('div');
      card.className = 'verb-card';
      card.dataset.index = index;
      card.innerHTML = `
        <div><strong>${verb.infinitive}</strong><br><small>${verb.arabic}</small></div>
        <div class="drop-zone" data-type="past participle" data-index="${index}">Drop Past Participle</div>
        <div class="drop-zone" data-type="perfect participle" data-index="${index}">Drop Perfect Participle</div>
      `;
      quizEl.appendChild(card);
    });
    this.addDropListeners();
  }

  renderChoices() {
    const choiceEl = document.getElementById('choices');
    choiceEl.innerHTML = '';
    // Collect all possible answers for all verbs in this quiz
    let allChoices = [];
    this.currentVerbs.forEach((verb) => {
      allChoices.push({ type: 'past participle', text: verb["past participle"] });
      allChoices.push({ type: 'perfect participle', text: verb["perfect participle"] });
    });

    // Count how many times each answer is used in placedAnswers
    const used = {};
    Object.values(this.placedAnswers).forEach(a => {
      const key = `${a.type}|${a.text}`;
      used[key] = (used[key] || 0) + 1;
    });

    // Only show as many as are unused (handle duplicates)
    const availableChoices = [];
    const choiceCounts = {};
    allChoices.forEach(item => {
      const key = `${item.type}|${item.text}`;
      choiceCounts[key] = (choiceCounts[key] || 0) + 1;
      const usedCount = used[key] || 0;
      // Only show as many as are unused
      const alreadyInList = availableChoices.filter(c => c.type === item.type && c.text === item.text).length;
      if (alreadyInList + usedCount < choiceCounts[key]) {
        availableChoices.push(item);
      }
    });

    // Shuffle for randomness
    const shuffled = availableChoices.sort(() => 0.5 - Math.random());
    shuffled.forEach(item => {
      const el = document.createElement('div');
      el.className = 'choice';
      el.textContent = item.text;
      el.setAttribute('draggable', 'true');
      el.dataset.type = item.type;
      el.dataset.value = item.text;
      el.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: item.type, text: item.text }));
      });
      choiceEl.appendChild(el);
    });
  }

  addDropListeners() {
    document.querySelectorAll('.drop-zone').forEach(zone => {
      zone.ondragover = e => e.preventDefault();
      zone.ondrop = e => {
        e.preventDefault();
        const item = JSON.parse(e.dataTransfer.getData('text/plain'));
        const index = zone.dataset.index;
        const type = zone.dataset.type;
        // Allow dropping any choice, regardless of type
        this.placedAnswers[`${index}-${type}`] = item;
        zone.textContent = item.text;
        zone.className = 'drop-zone';
        this.renderChoices();
      };
      // Allow removing a placed answer by clicking the drop zone
      zone.onclick = () => {
        const index = zone.dataset.index;
        const type = zone.dataset.type;
        if (this.placedAnswers[`${index}-${type}`]) {
          delete this.placedAnswers[`${index}-${type}`];
          zone.textContent = `Drop ${type.charAt(0).toUpperCase() + type.slice(1)}`;
          zone.className = 'drop-zone';
          this.renderChoices();
        }
      };
    });
  }

  showSubmitBtn() {
    let submitBtn = document.getElementById('submitBtn');
    if (!submitBtn) {
      submitBtn = document.createElement('button');
      submitBtn.id = 'submitBtn';
      submitBtn.className = 'cta';
      submitBtn.textContent = 'Submit';
      submitBtn.style.display = '';
      submitBtn.onclick = () => this.checkAnswers();
      document.querySelector('.container').appendChild(submitBtn);
    }
    submitBtn.style.display = '';
  }

  hideSubmitBtn() {
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.style.display = 'none';
  }

  checkAnswers() {
    // Show correct/incorrect for each drop-zone
    let allCorrect = true;
    document.querySelectorAll('.drop-zone').forEach(zone => {
      const index = zone.dataset.index;
      const type = zone.dataset.type;
      const verb = this.currentVerbs[index];
      const correct = verb[type];
      const answer = this.placedAnswers[`${index}-${type}`];
      if (answer && answer.text === correct) {
        zone.className = 'drop-zone correct';
      } else {
        zone.className = 'drop-zone incorrect';
        allCorrect = false;
      }
    });

    const submitBtn = document.getElementById('submitBtn');
    if (!allCorrect) {
      submitBtn.textContent = 'Retry';
      submitBtn.onclick = () => {
        // Reset only incorrect answers
        document.querySelectorAll('.drop-zone.incorrect').forEach(zone => {
          const index = zone.dataset.index;
          const type = zone.dataset.type;
          zone.textContent = `Drop ${type.charAt(0).toUpperCase() + type.slice(1)}`;
          zone.className = 'drop-zone';
          delete this.placedAnswers[`${index}-${type}`];
        });
        this.renderChoices();
        submitBtn.textContent = 'Submit';
        submitBtn.onclick = () => this.checkAnswers();
      };
    } else {
      this.hideSubmitBtn();
    }
  }
}

// Show main interface (menu)
function showMenuUI() {
  document.getElementById('difficulty').style.display = '';
  document.getElementById('verbcard').style.display = 'none';
  document.getElementById('controls').style.display = '';
  document.getElementById('menuBtn').style.display = 'none';
  document.getElementById('nextBtn').style.display = 'none';
  document.getElementById('quiz').style.display = 'none';
  document.getElementById('choices').style.display = 'none';
}

// Show quiz/game interface
function showQuizUI() {
  document.getElementById('difficulty').style.display = 'none';
  document.getElementById('verbcard').style.display = '';
}

// Load JSON and start app
fetch('verbs.json')
  .then(response => response.json())
  .then(data => {
    const manager = new QuizManager(data);

    document.getElementById('easyBtn').addEventListener('click', () => {
      manager.setMode('easy');
      showQuizUI();
      manager.loadNewQuiz();
    });

    document.getElementById('hardBtn').addEventListener('click', () => {
      manager.setMode('hard');
      showQuizUI();
      manager.loadNewQuiz();
    });

    document.getElementById('nextBtn').addEventListener('click', () => {
      manager.loadNewQuiz();
    });

    document.getElementById('menuBtn').addEventListener('click', () => {
      showMenuUI();
      manager.hideSubmitBtn();
    });

    // Start with menu UI
    showMenuUI();
  })
  .catch(err => {
    console.error('Error loading verbs.json:', err);
  });
