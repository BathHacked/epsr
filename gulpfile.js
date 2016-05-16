var gulp = require('gulp');
var include = require('gulp-include');
var uglify = require('gulp-uglify');

gulp.task("scripts", function() {
  gulp.src("src/js/*.js")
    .pipe(include())
    .on('error', console.log)
    .pipe(uglify())
    .pipe(gulp.dest("public/js"));
});

gulp.task("watch", function() {
  gulp.watch("./src/**/*.js", ['scripts']);
});

gulp.task("default", ["scripts", "watch"]);