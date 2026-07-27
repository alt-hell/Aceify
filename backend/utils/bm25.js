/**
 * BM25 Search Engine — fully offline, no downloads required
 * 
 * BM25 (Best Match 25) is the same algorithm used by Elasticsearch,
 * Lucene, and Solr for text retrieval. It's highly accurate for
 * short Q&A matching and requires zero internet or model files.
 * 
 * k1 = term frequency saturation (1.5 = standard)
 * b  = document length normalization (0.75 = standard)
 */
class BM25 {
  constructor(documents, k1 = 1.5, b = 0.75) {
    this.k1 = k1
    this.b = b
    this.documents = documents
    this._build()
  }

  // Tokenize: lowercase, strip punctuation, split on whitespace
  _tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !STOPWORDS.has(w))
  }

  _build() {
    this.corpus = this.documents.map(d => this._tokenize(d))
    this.N = this.corpus.length
    this.avgdl = this.corpus.reduce((s, d) => s + d.length, 0) / (this.N || 1)

    // Inverse Document Frequency
    this.idf = {}
    this.corpus.forEach(tokens => {
      new Set(tokens).forEach(t => {
        this.idf[t] = (this.idf[t] || 0) + 1
      })
    })
    Object.keys(this.idf).forEach(t => {
      const df = this.idf[t]
      this.idf[t] = Math.log((this.N - df + 0.5) / (df + 0.5) + 1)
    })
  }

  _score(queryTokens, docIdx) {
    const tokens = this.corpus[docIdx]
    const docLen = tokens.length
    const tf = {}
    tokens.forEach(t => { tf[t] = (tf[t] || 0) + 1 })

    return queryTokens.reduce((score, t) => {
      if (!this.idf[t]) return score
      const freq = tf[t] || 0
      const num = freq * (this.k1 + 1)
      const den = freq + this.k1 * (1 - this.b + this.b * (docLen / this.avgdl))
      return score + this.idf[t] * (num / den)
    }, 0)
  }

  search(query, topK = 1) {
    const qTokens = this._tokenize(query)
    if (qTokens.length === 0) return []

    const scores = this.documents.map((_, i) => ({
      index: i,
      score: this._score(qTokens, i)
    }))
    return scores.sort((a, b) => b.score - a.score).slice(0, topK)
  }
}

// Common English stopwords to ignore during matching
const STOPWORDS = new Set([
  'a','an','the','is','it','in','on','at','to','for','of','and','or','but',
  'not','with','as','by','this','that','are','was','were','be','been','have',
  'has','had','do','does','did','will','would','could','should','may','might',
  'can','i','you','he','she','we','they','me','him','her','us','them','my',
  'your','his','its','our','their','what','which','who','how','when','where',
  'why','there','here','so','if','then','than','also','just','about','more',
  'from','into','through','during','before','after','above','between','each'
])

module.exports = { BM25 }
