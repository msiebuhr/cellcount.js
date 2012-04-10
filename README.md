Cell Count
==========

An attempt to see if somewhat reasonable scientific computing can be done
client-side, in JavaScript.

Getting started
===============

Visit http://msiebuhr.github.com/cellcount.js/ and upload your image. Click a
spot in the image, and it will count the number of similar-colored blobs found
elsewhere in the image.

Warning: quite slow for large image/blobs.

Developing
==========

Clone the repository, run `make run` (starts a simple Python web-server; any
server should do fine), and hack away.

Note: I'm mis-using the `gh-pages`, so the repository automagically gets
exposed as a web-page. Thus, if you add the following to your `.git/config`, it
will use `gh-pages` as the default branch instead of `master`:

	[branch "gh-pages"]
		remote = origin
		merge = refs/heads/gh-pages

License
=======

Two-clause BSD; see `LICENSE`.
