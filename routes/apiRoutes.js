const axios = require("axios");
const cheerio = require("cheerio");

const db = require("../models");
const { request } = require("express");

module.exports = (app) => {
  app.get("/scrape", (req, res) => {
    axios.get("https://hackernoon.com/").then((resp) => {
      let $ = cheerio.load(resp.data);
      let results = [];
      let requests = [];

      $("article h2").each(function (i, element) {
        let obj = {};
        obj.title = $(this).children("a").text();
        obj.link = `https://hackernoon.com/${$(this)
          .children("a")
          .attr("href")}`;
        results.push(obj);
        requests.push(axios.get(obj.link));
      });

      axios.all(requests).then(
        axios.spread((...responses) => {
          responses.forEach((article, i) => {
            let $ = cheerio.load(article.data);

            results[i].body =
              $("div > .paragraph")
                .first()
                .text()
                .split(" ")
                .slice(0, 10)
                .join(" ") + "...";
          });

          db.Article.insertMany(results)
            .then(function () {
              console.log("complete");
              res.send("Scrape Complete");
            })
            .catch(function (err) {
              res.json(err);
            });
        })
      );
    });
  });

  app.get("/api/articles", (req, res) => {
    db.Article.find({})
      .then((resp) => {
        res.json(resp);
      })
      .catch((err) => {
        res.json(err);
      });
  });

  app.delete("/api/clear", (req, res) => {
    db.Article.deleteMany({})
      .then((resp) => {
        res.json(resp);
      })
      .catch((err) => {
        res.json(err);
      });
  });

  app.post("/api/note/:id", (req, res) => {
    db.Note.create(req.body)
      .then((dbNote) => {
        db.Article.findOneAndUpdate(
          { _id: req.params.id },
          { $push: { notes: dbNote._id } },
          { new: true }
        )
          .then(() => {
            res.send(dbNote);
          })
          .catch((err) => {
            res.json(err);
          });
      })
      .catch((err) => {
        res.json(err);
      });
  });

  app.put("/api/article/save/:id", (req, res) => {
    db.Article.findOneAndUpdate(
      { _id: req.params.id },
      { saved: true },
      { new: true }
    )
      .then((resp) => {
        res.json(resp);
      })
      .catch((err) => {
        res.json(err);
      });
  });

  app.get("/api/article/notes/:id", (req, res) => {
    db.Article.findOne({ _id: req.params.id })
      .populate("notes")
      .then((dbArticle) => {
        res.send(dbArticle.notes);
      })
      .catch((err) => {
        res.json(err);
      });
  });

  app.delete("/api/note/delete/:noteId/:articleId", (req, res) => {
    db.Note.deleteOne({ _id: req.params.noteId })
      .then((dbNote) => {
        db.Article.update(
          { _id: req.params.articleId },
          { $pull: { notes: req.params.noteId } }
        )
          .then((dbArticle) => {
            res.send(dbArticle);
          })
          .catch((err) => {
            res.json(err);
          });
      })
      .catch((err) => {
        res.json(err);
      });
  });
};
