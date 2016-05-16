#!/usr/bin/env bash

DATA=${EPSR_DATA:-"/var/sites/f/fiodev.co.uk/public_html/data/epsr/data"}

cd $DATA

wget --no-check-certificate -q -O epsr.csv "https://data.bathhacked.org/api/views/nrff-vhud/rows.csv?accessType=DOWNLOAD"

sed -i '1{s/\b \b/_/g;s/[[:upper:]]/\L&/g;}' epsr.csv
